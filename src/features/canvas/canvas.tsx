import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { DotGrid } from '@/features/canvas/dot-grid';
import { hitTest, layoutCanvas, type TileRect } from '@/features/canvas/layout';
import { Tile } from '@/features/canvas/tile';
import { useWheel } from '@/features/canvas/use-wheel';
import { Lens, type LensSession } from '@/features/lens/lens';
import type { Item } from '@/lib/types';
import { canvas as tokens, colors, lens as lensTokens } from '@/theme/tokens';

const EDGE = 48;
const LENS_R = lensTokens.diameter / 2;

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

type LensMode = 'hold' | 'hover';

/** Increment resetSignal to animate back to the default view. */
export function Canvas({ items, resetSignal = 0 }: { items: Item[]; resetSignal?: number }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const layout = useMemo(
    () => (size.width ? layoutCanvas(items, size.width, size.height) : null),
    [items, size.width, size.height],
  );
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const fx = useSharedValue(0);
  const fy = useSharedValue(0);
  const progress = useSharedValue(0);
  const lensOn = useSharedValue(false);
  const activeSV = useSharedValue('');

  const [session, setSession] = useState<LensSession | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<View>(null);
  // Plain mutable state for event handlers. Shared values rather than refs so the
  // React Compiler knows none of it is read during render.
  const lensMode = useSharedValue<LensMode | ''>('');
  const hover = useSharedValue({ x: 0, y: 0, ax: 0, ay: 0 });
  const hoverTimer = useSharedValue(0);

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

    const openLens = (mode: LensMode, id: string) => {
      const s = scale.get();
      const left = (-tx.get() - LENS_R) / s;
      const top = (-ty.get() - LENS_R) / s;
      const right = (vw - tx.get() + LENS_R) / s;
      const bottom = (vh - ty.get() + LENS_R) / s;
      lensMode.set(mode);
      setSession({
        tiles: tiles.filter((t) => t.x + t.w >= left && t.x <= right && t.y + t.h >= top && t.y <= bottom),
        tx: tx.get(),
        ty: ty.get(),
        scale: s,
      });
      setActiveId(id);
      activeSV.set(id);
      progress.set(0);
      progress.set(withSpring(1, { damping: 18, stiffness: 280, mass: 0.7 }));
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const clearSession = () => {
      if (!lensMode.get()) setSession(null);
    };

    const closeLens = () => {
      if (!lensMode.get()) return;
      lensMode.set('');
      lensOn.set(false);
      activeSV.set('');
      setActiveId(null);
      progress.set(
        withTiming(0, { duration: 140 }, (finished) => {
          if (finished) scheduleOnRN(clearSession);
        }),
      );
    };

    const cancelHover = () => {
      if (hoverTimer.get()) clearTimeout(hoverTimer.get());
      hoverTimer.set(0);
      if (lensMode.get() === 'hover') closeLens();
    };

    // Web: rest the pointer on a tile for ~600ms to open the lens; it then follows the pointer.
    const trackHover = (x: number, y: number) => {
      const prev = hover.get();
      if (lensMode.get() === 'hover') {
        fx.set(x);
        fy.set(y);
        const id = tileAt(x, y)?.id ?? null;
        if (id !== activeSV.get()) {
          activeSV.set(id ?? '');
          setActiveId(id);
        }
        return;
      }
      if (lensMode.get()) return;
      if (hoverTimer.get() && Math.hypot(x - prev.ax, y - prev.ay) <= 4) {
        hover.set({ ...prev, x, y });
        return;
      }
      hover.set({ x, y, ax: x, ay: y });
      if (hoverTimer.get()) clearTimeout(hoverTimer.get());
      const timer = setTimeout(() => {
        hoverTimer.set(0);
        if (lensMode.get()) return;
        const p = hover.get();
        const t = tileAt(p.x, p.y);
        if (!t) return;
        fx.set(p.x);
        fy.set(p.y);
        lensOn.set(true);
        openLens('hover', t.id);
      }, lensTokens.hoverMs);
      hoverTimer.set(timer as unknown as number);
    };

    const openDetail = (x: number, y: number) => {
      const t = tileAt(x, y);
      if (t) router.push({ pathname: '/item/[id]', params: { id: t.id } });
    };

    const onWheel = ({ x, y, dx, dy, zoom }: { x: number; y: number; dx: number; dy: number; zoom: boolean }) => {
      if (lensMode.get() === 'hold') return;
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

    // Touch and hold on a tile, then drag: the lens follows the finger and closes on lift.
    const hold = Gesture.Pan()
      .activateAfterLongPress(lensTokens.holdMs)
      .onStart((e) => {
        const t = hitTest(tiles, (e.x - tx.get()) / scale.get(), (e.y - ty.get()) / scale.get());
        if (!t) return;
        fx.set(e.x);
        fy.set(e.y);
        lensOn.set(true);
        scheduleOnRN(cancelHover);
        scheduleOnRN(openLens, 'hold', t.id);
      })
      .onUpdate((e) => {
        if (!lensOn.get()) return;
        fx.set(e.x);
        fy.set(e.y);
        const id = hitTest(tiles, (e.x - tx.get()) / scale.get(), (e.y - ty.get()) / scale.get())?.id ?? '';
        if (id !== activeSV.get()) {
          activeSV.set(id);
          scheduleOnRN(setActiveId, id || null);
        }
      })
      .onFinalize(() => {
        if (lensOn.get()) scheduleOnRN(closeLens);
      });

    const touch = Gesture.Race(hold, tap, Gesture.Simultaneous(pan, pinch));

    const gesture =
      Platform.OS === 'web'
        ? Gesture.Simultaneous(
            Gesture.Hover()
              .runOnJS(true)
              .onBegin((e) => trackHover(e.x, e.y))
              .onUpdate((e) => trackHover(e.x, e.y))
              .onFinalize(() => cancelHover()),
            touch,
          )
        : touch;

    return { gesture, onWheel };
  }, [layout, size.width, size.height, tx, ty, scale, fx, fy, progress, lensOn, activeSV, lensMode, hover, hoverTimer]);

  useWheel(containerRef, handlers.onWheel);

  const world = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  return (
    <View ref={containerRef} style={styles.container} onLayout={onLayout}>
      <GestureDetector gesture={handlers.gesture}>
        <View style={styles.clip}>
          <DotGrid id="canvas-dots" tx={tx} ty={ty} scale={scale} width={size.width} height={size.height} />
          {layout && (
            <Animated.View
              style={[styles.world, { width: layout.width, height: layout.height }, world]}>
              {layout.tiles.map((t) => {
                const item = itemsById.get(t.id);
                return item ? (
                  <View key={t.id} style={{ position: 'absolute', left: t.x, top: t.y }}>
                    <Tile item={item} width={t.w} height={t.h} />
                  </View>
                ) : null;
              })}
            </Animated.View>
          )}
        </View>
      </GestureDetector>
      {session && (
        <Lens session={session} itemsById={itemsById} activeId={activeId} fx={fx} fy={fy} progress={progress} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Not clipped, and stacked above the header and dock, so the lens can spill over them.
  container: {
    flex: 1,
    zIndex: 2,
    ...(Platform.OS === 'web' ? ({ userSelect: 'none' } as object) : null),
  },
  clip: { ...StyleSheet.absoluteFill, overflow: 'hidden', backgroundColor: colors.canvas },
  world: { position: 'absolute', left: 0, top: 0, transformOrigin: 'top left', pointerEvents: 'none' },
});
