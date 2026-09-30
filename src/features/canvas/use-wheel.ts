import type { RefObject } from 'react';
import type { View } from 'react-native';

export type WheelHandler = (e: { x: number; y: number; dx: number; dy: number; zoom: boolean }) => void;

/** Mouse wheel / trackpad only exist on web; see use-wheel.web.ts. */
export function useWheel(_ref: RefObject<View | null>, _onWheel: WheelHandler) {}
