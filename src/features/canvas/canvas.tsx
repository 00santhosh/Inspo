import {
  Canvas as SkiaCanvas,
  drawAsPicture,
  Fill,
  FilterMode,
  Group,
  Rect,
  RuntimeShader,
  Shader,
  Skia,
  TileMode,
  type SkPaint,
  type SkPicture,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { HeldCaption } from '@/features/canvas/held-caption';
import { hitIndex, hitTest, layoutCanvas, type TileRect } from '@/features/canvas/layout';
import { useWheel } from '@/features/canvas/use-wheel';
import { useCanvasFonts, useSkiaImages } from '@/features/skia/resources';
import { bulgeFilterEffect, bulgePictureEffect, dotGridEffect } from '@/features/skia/shaders';
import { SkiaTile } from '@/features/skia/skia-tile';
import type { Item } from '@/lib/types';
import { bulge, colors, canvas as tokens } from '@/theme/tokens';

const EDGE = 48;
const INFLATE_SPRING = { damping: 14, stiffness: 180, mass: 0.9 };
// Only smooths the jump when the balloon flips between above and below the finger.
const FLIP_SPRING = { damping: 26, stiffness: 520, mass: 0.5 };

/** Allowed translation range for one axis; pins the world to the top-left when it fits in the view. */
function range(s: number, view: number, world: number): [number, number] {
  'worklet';
  const span = world * s;
  if (span + EDGE <= view) return [0, 0];
  return [view - span - EDGE, EDGE];
}

function clampTo(t: number, s: number, view: number, world: number) {
  'worklet';
  const [min, max] = range(s, view, world);
  return Math.min(max, Math.max(min, t));
}

function clampScale(s: number) {
  'worklet';
  return Math.min(tokens.maxScale, Math.max(tokens.minScale, s));
}

/** -1..1: how far into an edge zone `pos` is (negative at the start edge), 0 outside it. */
function edgePush(pos: number, size: number, zone: number) {
  'worklet';
  if (pos < zone) return -Math.pow((zone - Math.max(0, pos)) / zone, 2);
  if (pos > size - zone) return Math.pow((Math.min(size, pos) - (size - zone)) / zone, 2);
  return 0;
}

/** Dot spacing on screen: 18–36pt at any zoom; doubling density keeps dots on the world grid. */
function dotCell(s: number) {
  'worklet';
  return tokens.dotSpacing * (s / Math.pow(2, Math.floor(Math.log2(s))));
}

function imageUrlOf(item: Item) {
  if (item.kind === 'link') return item.link?.imageUrl ?? null;
  if (item.kind === 'image' || item.kind === 'video') return item.thumbUrl ?? item.mediaUrl ?? null;
  return null;
}

type Mode = 'hold' | 'hover';

// On native the balloon is a live image filter over the canvas. Skia's web build
// (CanvasKit) has no runtime-shader image filter, so on web the canvas is recorded as a
// picture when the balloon starts and the balloon shader draws from that picture,
// positioned by the live pan offset, so auto-scroll still works.
const LIVE_FILTER = Platform.OS !== 'web';

/** Increment resetSignal to animate back to the default view. */
export function Canvas({ items, resetSignal = 0 }: { items: Item[]; resetSignal?: number }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const layout = useMemo(
    () => (size.width ? layoutCanvas(items, size.width, size.height) : null),
    [items, size.width, size.height],
  );
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const fonts = useCanvasFonts();
  const { images, version: imagesVersion } = useSkiaImages(
    useMemo(() => items.map(imageUrlOf).filter((u): u is string => !!u), [items]),
  );
  const R = Math.min(bulge.maxRadius, (size.width * bulge.widthRatio) / 2);
  const gridColors = useMemo(
    () => ({ dot: Array.from(Skia.Color(colors.dot)), background: Array.from(Skia.Color(colors.canvas)) }),
    [],
  );

  // Canvas pan and zoom.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);

  // Balloon, in container coordinates: the finger, where the balloon sits, the point it
  // magnifies (the finger), and how inflated it is.
  const fx = useSharedValue(0);
  const fy = useSharedValue(0);
  const cx = useSharedValue(0);
  const cy = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const strength = useSharedValue(0);
  const heldIndex = useSharedValue(-1);
  const active = useSharedValue(false);

  // Event-handler state. Shared values rather than refs so the React Compiler knows
  // none of it is read during render.
  const mode = useSharedValue<Mode | ''>('');
  const hover = useSharedValue({ x: 0, y: 0, ax: 0, ay: 0 });
  const hoverTimer = useSharedValue(0);

  const [heldId, setHeldId] = useState<string | null>(null);
  // The bulge costs a full-canvas pass per frame, so it is only attached while in use.
  const [bulging, setBulging] = useState(false);
  const [scenePicture, setScenePicture] = useState<SkPicture | null>(null);
  const containerRef = useRef<View>(null);

  const worldTransform = useDerivedValue(() => [
    { translateX: tx.get() },
    { translateY: ty.get() },
    { scale: scale.get() },
  ]);
  const dotUniforms = useDerivedValue(() => ({
    origin: [tx.get(), ty.get()],
    cell: dotCell(scale.get()),
    radius: tokens.dotRadius,
    dotColor: gridColors.dot,
    background: gridColors.background,
  }));
  const bulgeUniforms = useDerivedValue(() => ({
    center: [cx.get(), cy.get()],
    source: [sx.get(), sy.get()],
    radius: R,
    strength: strength.get(),
    zoom: bulge.zoom,
  }));

  const renderTiles = (playing: boolean) =>
    layout?.tiles.map((t) => {
      const item = itemsById.get(t.id);
      if (!item) return null;
      const url = imageUrlOf(item);
      return (
        <SkiaTile
          key={t.id}
          item={item}
          r={t}
          image={url ? (images.get(url) ?? null) : null}
          fonts={fonts}
          playing={playing && t.id === heldId && item.kind === 'video'}
        />
      );
    });

  // Web: record the tiles as a picture when the balloon starts, and again if more images
  // arrive while it is up (tiles scrolled into view may still be loading).
  const worldW = layout?.width ?? 0;
  const worldH = layout?.height ?? 0;
  useEffect(() => {
    if (LIVE_FILTER || !bulging) return;
    let cancelled = false;
    drawAsPicture(<Group>{renderTiles(false)}</Group>, Skia.XYWHRect(0, 0, worldW, worldH)).then(
      (picture) => {
        if (!cancelled) setScenePicture(picture);
      },
    );
    return () => {
      cancelled = true;
    };
    // The picture is positioned live by the pan offset, so panning needs no re-record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulging, imagesVersion]);

  const webPaint = useDerivedValue<SkPaint | null>(() => {
    if (LIVE_FILTER || !scenePicture) return null;
    const s = scale.get();
    // Rasterise only the visible part of the world (plus a margin): Skia downsamples
    // large picture tiles, which made the whole canvas blurry. The tile's top-left is
    // the shader's origin, so shift it back to its world position.
    const margin = 24;
    const x0 = -tx.get() / s - margin;
    const y0 = -ty.get() / s - margin;
    const m = Skia.Matrix();
    m.translate(tx.get(), ty.get());
    m.scale(s, s);
    m.translate(x0, y0);
    const scene = scenePicture.makeShader(
      TileMode.Decal,
      TileMode.Decal,
      FilterMode.Linear,
      m,
      Skia.XYWHRect(x0, y0, size.width / s + margin * 2, size.height / s + margin * 2),
    );
    // Same order as the uniforms are declared in bulgePictureEffect.
    const uniforms = [
      cx.get(), cy.get(), sx.get(), sy.get(), R, strength.get(), bulge.zoom,
      tx.get(), ty.get(), dotCell(s), tokens.dotRadius, ...gridColors.dot, ...gridColors.background,
    ];
    const paint = Skia.Paint();
    paint.setShader(bulgePictureEffect().makeShaderWithChildren(uniforms, [scene]));
    return paint;
  });

  // Start each layout (first load, filter change, resize) from the top-left.
  useEffect(() => {
    if (!layout) return;
    tx.set(clampTo(0, 1, size.width, layout.width));
    ty.set(clampTo(0, 1, size.height, layout.height));
    scale.set(1);
  }, [layout, size.width, size.height, tx, ty, scale]);

  useEffect(() => {
    if (!layout || resetSignal === 0) return;
    const ease = { duration: 320 };
    scale.set(withTiming(1, ease));
    tx.set(withTiming(clampTo(0, 1, size.width, layout.width), ease));
    ty.set(withTiming(clampTo(0, 1, size.height, layout.height), ease));
    // Only on an explicit reset, not when the layout changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const handlers = useMemo(() => {
    const tiles: TileRect[] = layout?.tiles ?? [];
    const W = layout?.width ?? 0;
    const H = layout?.height ?? 0;
    const vw = size.width;
    const vh = size.height;

    const tileAt = (x: number, y: number) => hitTest(tiles, (x - tx.get()) / scale.get(), (y - ty.get()) / scale.get());

    /**
     * Track the finger. The balloon sits just above the fingertip (below it near the top
     * edge) and magnifies exactly what is under the finger, so it glides smoothly across
     * tiles and the gaps between them. `start` snaps the flip position instead of animating.
     */
    const follow = (x: number, y: number, start: boolean) => {
      'worklet';
      fx.set(x);
      fy.set(y);
      const s = scale.get();
      const i = hitIndex(tiles, (x - tx.get()) / s, (y - ty.get()) / s);
      if (i >= 0 && i !== heldIndex.get()) {
        heldIndex.set(i);
        scheduleOnRN(setHeldId, tiles[i].id);
      }
      const lift = R * bulge.lift;
      const ballY = y - lift - R < 0 ? y + lift : y - lift;
      // May hang a little off-screen, so it stays close to a finger at the edge.
      const ballX = Math.min(Math.max(x, R * 0.25), vw - R * 0.25);
      cx.set(ballX);
      cy.set(start ? ballY : withSpring(ballY, FLIP_SPRING));
      // The magnified point is the finger, kept within reach of the balloon's centre:
      // pulled too far (finger at a screen edge) the dome twists.
      const dx = x - ballX;
      const dy = y - ballY;
      const reach = R * 0.45;
      const k = Math.min(1, reach / Math.max(1, Math.hypot(dx, dy)));
      sx.set(ballX + dx * k);
      sy.set(ballY + dy * k);
    };

    /** Inflate the balloon under (x, y). Returns false when there is no tile there. */
    const startBulge = (x: number, y: number) => {
      'worklet';
      const s = scale.get();
      if (hitIndex(tiles, (x - tx.get()) / s, (y - ty.get()) / s) < 0) return false;
      follow(x, y, true);
      active.set(true);
      strength.set(0);
      strength.set(withSpring(1, INFLATE_SPRING));
      scheduleOnRN(setBulging, true);
      return true;
    };

    const finishBulge = () => {
      if (mode.get()) return;
      heldIndex.set(-1);
      setHeldId(null);
      setBulging(false);
      setScenePicture(null);
    };

    const endBulge = () => {
      if (!mode.get()) return;
      mode.set('');
      active.set(false);
      strength.set(
        withTiming(0, { duration: 220 }, (finished) => {
          if (finished) scheduleOnRN(finishBulge);
        }),
      );
    };

    const cancelHover = () => {
      if (hoverTimer.get()) clearTimeout(hoverTimer.get());
      hoverTimer.set(0);
      if (mode.get() === 'hover') endBulge();
    };

    // A hold can start while a hover bulge is already up (click-and-hold on web, or
    // browsers that report touch as a mouse): the hold takes it over.
    const startHold = () => {
      if (hoverTimer.get()) clearTimeout(hoverTimer.get());
      hoverTimer.set(0);
      const fresh = mode.get() !== 'hover';
      mode.set('hold');
      if (fresh && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Web: rest the pointer on a tile for ~600ms to inflate the balloon; it then follows the pointer.
    const trackHover = (x: number, y: number) => {
      const prev = hover.get();
      if (mode.get() === 'hover') {
        follow(x, y, false);
        return;
      }
      if (mode.get()) return;
      if (hoverTimer.get() && Math.hypot(x - prev.ax, y - prev.ay) <= 4) {
        hover.set({ ...prev, x, y });
        return;
      }
      hover.set({ x, y, ax: x, ay: y });
      if (hoverTimer.get()) clearTimeout(hoverTimer.get());
      const timer = setTimeout(() => {
        hoverTimer.set(0);
        if (mode.get()) return;
        const p = hover.get();
        if (startBulge(p.x, p.y)) mode.set('hover');
      }, bulge.hoverMs);
      hoverTimer.set(timer as unknown as number);
    };

    const openDetail = (x: number, y: number) => {
      const t = tileAt(x, y);
      if (t) router.push({ pathname: '/item/[id]', params: { id: t.id } });
    };

    const onWheel = ({ x, y, dx, dy, zoom }: { x: number; y: number; dx: number; dy: number; zoom: boolean }) => {
      if (mode.get() === 'hold') return;
      cancelHover();
      cancelAnimation(tx);
      cancelAnimation(ty);
      const s = scale.get();
      if (zoom) {
        const next = clampScale(s * Math.exp(-dy * 0.01));
        const k = next / s;
        scale.set(next);
        tx.set(clampTo(x - (x - tx.get()) * k, next, vw, W));
        ty.set(clampTo(y - (y - ty.get()) * k, next, vh, H));
      } else {
        tx.set(clampTo(tx.get() - dx, s, vw, W));
        ty.set(clampTo(ty.get() - dy, s, vh, H));
      }
    };

    /** Edge auto-scroll while holding: called every frame with the frame's duration. */
    const autoScroll = (dt: number) => {
      'worklet';
      if (!active.get() || mode.get() !== 'hold') return;
      const x = fx.get();
      const y = fy.get();
      const px = edgePush(x, vw, bulge.autoScrollZone);
      const py = edgePush(y, vh, bulge.autoScrollZone);
      if (px === 0 && py === 0) return;
      const s = scale.get();
      // Finger near the right edge reveals what is to the right: the world moves left.
      tx.set(clampTo(tx.get() - px * bulge.autoScrollSpeed * dt, s, vw, W));
      ty.set(clampTo(ty.get() - py * bulge.autoScrollSpeed * dt, s, vh, H));
      follow(x, y, false);
    };

    const pan = Gesture.Pan()
      .onStart(() => {
        cancelAnimation(tx);
        cancelAnimation(ty);
        scheduleOnRN(cancelHover);
      })
      .onChange((e) => {
        const s = scale.get();
        tx.set(clampTo(tx.get() + e.changeX, s, vw, W));
        ty.set(clampTo(ty.get() + e.changeY, s, vh, H));
      })
      .onEnd((e) => {
        const s = scale.get();
        tx.set(withDecay({ velocity: e.velocityX, clamp: range(s, vw, W) }));
        ty.set(withDecay({ velocity: e.velocityY, clamp: range(s, vh, H) }));
      });

    const pinch = Gesture.Pinch()
      .onStart(() => {
        cancelAnimation(tx);
        cancelAnimation(ty);
      })
      .onChange((e) => {
        const prev = scale.get();
        const next = clampScale(prev * e.scaleChange);
        const k = next / prev;
        tx.set(e.focalX - (e.focalX - tx.get()) * k);
        ty.set(e.focalY - (e.focalY - ty.get()) * k);
        scale.set(next);
      })
      .onEnd(() => {
        const s = scale.get();
        tx.set(withSpring(clampTo(tx.get(), s, vw, W), { damping: 20 }));
        ty.set(withSpring(clampTo(ty.get(), s, vh, H), { damping: 20 }));
      });

    const tap = Gesture.Tap()
      .maxDuration(250)
      .runOnJS(true)
      .onEnd((e, ok) => {
        if (ok) openDetail(e.x, e.y);
      });

    // Touch and hold a tile: a balloon pushes the canvas up from behind, just above the
    // finger, follows a drag (scrolling the canvas near the edges), and deflates on lift.
    const hold = Gesture.Pan()
      .activateAfterLongPress(bulge.holdMs)
      .onStart((e) => {
        if (active.get()) follow(e.x, e.y, false);
        else if (!startBulge(e.x, e.y)) return;
        scheduleOnRN(startHold);
      })
      .onUpdate((e) => {
        if (active.get()) follow(e.x, e.y, false);
      })
      .onFinalize(() => {
        if (active.get()) scheduleOnRN(endBulge);
      });

    const touch = Gesture.Race(hold, tap, Gesture.Simultaneous(pan, pinch));

    const gesture =
      Platform.OS === 'web'
        ? Gesture.Simultaneous(
            // Mouse only: on touch screens the browser also reports hover, which would
            // race the hold gesture.
            Gesture.Hover()
              .runOnJS(true)
              .onBegin((e) => {
                if (e.pointerType === PointerType.MOUSE) trackHover(e.x, e.y);
              })
              .onUpdate((e) => {
                if (e.pointerType === PointerType.MOUSE) trackHover(e.x, e.y);
              })
              .onFinalize((e) => {
                if (e.pointerType === PointerType.MOUSE) cancelHover();
              }),
            touch,
          )
        : touch;

    return { gesture, onWheel, autoScroll };
  }, [layout, size.width, size.height, R, tx, ty, scale, fx, fy, cx, cy, sx, sy, strength, heldIndex, active, mode, hover, hoverTimer]);

  useWheel(containerRef, handlers.onWheel);

  const scroller = useFrameCallback((frame) => {
    handlers.autoScroll(Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000));
  }, false);
  useEffect(() => {
    scroller.setActive(bulging);
  }, [bulging, scroller]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  const held = heldId ? itemsById.get(heldId) : undefined;

  return (
    <View ref={containerRef} style={styles.container} onLayout={onLayout}>
      <GestureDetector gesture={handlers.gesture}>
        <View style={styles.clip}>
          {size.width > 0 && (
            <SkiaCanvas style={StyleSheet.absoluteFill}>
              <Group>
                {bulging && LIVE_FILTER ? <RuntimeShader source={bulgeFilterEffect()} uniforms={bulgeUniforms} /> : null}
                <Fill>
                  <Shader source={dotGridEffect()} uniforms={dotUniforms} />
                </Fill>
                <Group transform={worldTransform}>{renderTiles(LIVE_FILTER && bulging)}</Group>
              </Group>
              {!LIVE_FILTER && bulging && scenePicture ? (
                <Rect x={0} y={0} width={size.width} height={size.height} paint={webPaint as unknown as SkPaint} />
              ) : null}
            </SkiaCanvas>
          )}
        </View>
      </GestureDetector>
      {held && bulging ? (
        <HeldCaption item={held} cx={cx} cy={cy} radius={R} strength={strength} viewWidth={size.width} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    zIndex: 2,
    ...(Platform.OS === 'web' ? ({ userSelect: 'none' } as object) : null),
  },
  clip: { ...StyleSheet.absoluteFill, overflow: 'hidden', backgroundColor: colors.canvas },
});
