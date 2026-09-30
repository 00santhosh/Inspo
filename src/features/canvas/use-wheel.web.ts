import { useEffect, useRef, type RefObject } from 'react';
import type { View } from 'react-native';

import type { WheelHandler } from './use-wheel';

/**
 * Wheel and trackpad input: two-finger scroll pans, pinch (which browsers report as
 * ctrl+wheel) or cmd/ctrl+wheel zooms around the pointer.
 */
export function useWheel(ref: RefObject<View | null>, onWheel: WheelHandler) {
  const handler = useRef(onWheel);
  useEffect(() => {
    handler.current = onWheel;
  });

  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) return;
    const listener = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1;
      handler.current({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        dx: e.deltaX * unit,
        dy: e.deltaY * unit,
        zoom: e.ctrlKey || e.metaKey,
      });
    };
    el.addEventListener('wheel', listener, { passive: false });
    return () => el.removeEventListener('wheel', listener);
  }, [ref]);
}
