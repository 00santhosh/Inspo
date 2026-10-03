import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BulgeFocus, type HeldItem } from '@/features/bulge/bulge-focus';
import { heldPlacement, heldZoom, lerpRect, type Rect } from '@/features/bulge/bulge-math';
import { BulgeTile } from '@/features/bulge/bulge-tile';
import { DotGrid } from '@/features/canvas/dot-grid';
import { hitIndex, hitTest, layoutCanvas, type TileRect } from '@/features/canvas/layout';
import { useWheel } from '@/features/canvas/use-wheel';
import type { Item } from '@/lib/types';
import { bulge, colors, canvas as tokens } from '@/theme/tokens';

const EDGE = 48;
const POP_SPRING = { damping: 15, stiffness: 220, mass: 0.8 };
const SWITCH_SPRING = { damping: 20, stiffness: 260, mass: 0.8 };
const FOLLOW_SPRING = { damping: 26, stiffness: 420, mass: 0.6 };

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

type Mode = 'hold' | 'hover';

/** Increment resetSignal to animate back to the default view. */
export function Canvas({ items, resetSignal = 0 }: { items: Item[]; resetSignal?: number }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const layout = useMemo(
    () => (size.width ? layoutCanvas(items, size.width, size.height) : null),
    [items, size.width, size.height],
  );
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Canvas pan and zoom.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);

  // Bulge state. World units unless noted.
  const fx = useSharedValue(0); // finger, container coordinates
  const fy = useSharedValue(0);
  const strength = useSharedValue(0); // 0 = flat canvas, 1 = fully inflated
  const heldIndex = useSharedValue(-1);
  const base = useSharedValue<Rect>({ x: 0, y: 0, w: 0, h: 0 }); // held tile's own rect
  const tgtX = useSharedValue(0); // where the held tile is going
  const tgtY = useSharedValue(0);
  const tgtW = useSharedValue(0);
  const tgtH = useSharedValue(0);
  const finalW = useSharedValue(0); // held tile's final size, screen points
  const finalH = useSharedValue(0);
  const sessionScale = useSharedValue(1);
  const minTop = useSharedValue(0);
  const active = useSharedValue(false);

  // Event-handler state. Shared values rather than refs so the React Compiler knows
  // none of it is read during render.
  const mode = useSharedValue<Mode | ''>('');
  const hover = useSharedValue({ x: 0, y: 0, ax: 0, ay: 0 });
  const hoverTimer = useSharedValue(0);

  const [held, setHeld] = useState<HeldItem | null>(null);
  const [windowTop, setWindowTop] = useState(0);
  const insets = useSafeAreaInsets();
  const containerRef = useRef<View>(null);

  // The held tile's current rect: from its spot on the canvas to its place above the finger.
  const heldWorld = useDerivedValue(() =>
    lerpRect(base.get(), { x: tgtX.get(), y: tgtY.get(), w: tgtW.get(), h: tgtH.get() }, strength.get()),
  );
  const heldScreen = useDerivedValue(() => {
    const r = heldWorld.get();
    const s = scale.get();
    return { x: r.x * s + tx.get(), y: r.y * s + ty.get(), w: r.w * s, h: r.h * s };
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

  // The held tile may rise over the header, but not past the status bar.
  useEffect(() => {
    minTop.set(insets.top + 8 - windowTop);
  }, [insets.top, windowTop, minTop]);

  const handlers = useMemo(() => {
    const tiles: TileRect[] = layout?.tiles ?? [];
    const W = layout?.width ?? 0;
    const H = layout?.height ?? 0;
    const vw = size.width;
    const vh = size.height;

    const tileAt = (x: number, y: number) => hitTest(tiles, (x - tx.get()) / scale.get(), (y - ty.get()) / scale.get());

    const showHeld = (index: number, width: number, height: number, k: number) => {
      const item = itemsById.get(tiles[index]?.id ?? '');
      if (item) setHeld({ item, width, height, k });
    };

    /**
     * Track the finger: the tile under it becomes the held one, and the held tile is
     * placed above the fingertip. `start` snaps instead of animating, for a new bulge.
     */
    const follow = (x: number, y: number, start: boolean) => {
      'worklet';
      fx.set(x);
      fy.set(y);
      const s = scale.get();
      const i = hitIndex(tiles, (x - tx.get()) / s, (y - ty.get()) / s);
      if (i >= 0 && (start || i !== heldIndex.get())) {
        const t = tiles[i];
        const z = heldZoom(t.w * s, t.h * s, vw, vh);
        finalW.set(t.w * s * z);
        finalH.set(t.h * s * z);
        if (start) {
          base.set({ x: t.x, y: t.y, w: t.w, h: t.h });
          tgtW.set(t.w * z);
          tgtH.set(t.h * z);
        } else {
          tgtW.set(withSpring(t.w * z, SWITCH_SPRING));
          tgtH.set(withSpring(t.h * z, SWITCH_SPRING));
        }
        heldIndex.set(i);
        scheduleOnRN(showHeld, i, t.w * s * z, t.h * s * z, s * z);
      }
      if (heldIndex.get() < 0) return;
      const p = heldPlacement(x, y, finalW.get(), finalH.get(), vw, minTop.get());
      const lx = (p.left - tx.get()) / s;
      const ly = (p.top - ty.get()) / s;
      if (start) {
        tgtX.set(lx);
        tgtY.set(ly);
      } else {
        tgtX.set(withSpring(lx, FOLLOW_SPRING));
        tgtY.set(withSpring(ly, FOLLOW_SPRING));
      }
    };

    /** Inflate the tile under (x, y). Returns false when there is no tile there. */
    const startBulge = (x: number, y: number) => {
      'worklet';
      const s = scale.get();
      if (hitIndex(tiles, (x - tx.get()) / s, (y - ty.get()) / s) < 0) return false;
      sessionScale.set(s);
      follow(x, y, true);
      active.set(true);
      strength.set(0);
      strength.set(withSpring(1, POP_SPRING));
      return true;
    };

    const clearHeld = () => {
      if (mode.get()) return;
      heldIndex.set(-1);
      setHeld(null);
    };

    const endBulge = () => {
      if (!mode.get()) return;
      mode.set('');
      active.set(false);
      strength.set(
        withTiming(0, { duration: 200 }, (finished) => {
          if (finished) scheduleOnRN(clearHeld);
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

    // Web: rest the pointer on a tile for ~600ms to inflate it; it then follows the pointer.
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

    // Touch and hold a tile: it bulges up above the finger, pushing its neighbours aside,
    // follows a drag across the canvas, and settles back on lift.
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

    return { gesture, onWheel };
  }, [
    layout,
    size.width,
    size.height,
    itemsById,
    tx,
    ty,
    scale,
    fx,
    fy,
    strength,
    heldIndex,
    base,
    tgtX,
    tgtY,
    tgtW,
    tgtH,
    finalW,
    finalH,
    sessionScale,
    minTop,
    active,
    mode,
    hover,
    hoverTimer,
  ]);

  useWheel(containerRef, handlers.onWheel);

  const world = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
    containerRef.current?.measureInWindow((_x, y) => setWindowTop(y));
  };

  return (
    <View ref={containerRef} style={styles.container} onLayout={onLayout}>
      <GestureDetector gesture={handlers.gesture}>
        <View style={styles.clip}>
          <DotGrid id="canvas-dots" tx={tx} ty={ty} scale={scale} width={size.width} height={size.height} />
          {layout && (
            <Animated.View style={[styles.world, { width: layout.width, height: layout.height }, world]}>
              {layout.tiles.map((t, i) => {
                const item = itemsById.get(t.id);
                return item ? (
                  <BulgeTile
                    key={t.id}
                    item={item}
                    rect={t}
                    index={i}
                    held={heldWorld}
                    base={base}
                    heldIndex={heldIndex}
                    strength={strength}
                    scale={sessionScale}
                  />
                ) : null;
              })}
            </Animated.View>
          )}
        </View>
      </GestureDetector>
      {held && <BulgeFocus held={held} rect={heldScreen} strength={strength} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // Not clipped, and stacked above the header, so the held tile can rise over it.
  container: {
    flex: 1,
    zIndex: 2,
    ...(Platform.OS === 'web' ? ({ userSelect: 'none' } as object) : null),
  },
  clip: { ...StyleSheet.absoluteFill, overflow: 'hidden', backgroundColor: colors.canvas },
  world: { position: 'absolute', left: 0, top: 0, transformOrigin: 'top left', pointerEvents: 'none' },
});
