import { Platform } from 'react-native';

// Palette sampled from design/ui-style-reference.png: deep navy canvas, a sky-to-hills
// gradient header, frosted glass controls and one saturated blue for primary actions.
export const colors = {
  canvas: '#090F14',
  dot: '#1C252E',
  surface: '#151C24',
  surfaceRaised: '#1B2430',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.62)',
  textTertiary: 'rgba(255, 255, 255, 0.42)',
  accent: '#1D75FD',
  accentText: '#FFFFFF',
  /** Frosted glass on the dark canvas. */
  glass: 'rgba(255, 255, 255, 0.12)',
  glassBorder: 'rgba(255, 255, 255, 0.16)',
  /** Frosted glass over the sky header. */
  glassOnSky: 'rgba(70, 84, 100, 0.42)',
  /** Smoked glass over photos and video, for badges. */
  glassOnMedia: 'rgba(24, 24, 28, 0.46)',
  dock: 'rgba(16, 22, 30, 0.78)',
  noteText: 'rgba(255, 255, 255, 0.9)',
  voiceAccent: '#5B9BFF',
} as const;

/** Header gradient, top to bottom: blue sky, haze, then blurred green hills. */
export const sky = {
  stops: [
    { offset: 0, color: '#6F8DB0' },
    { offset: 0.34, color: '#7796B7' },
    { offset: 0.62, color: '#A0B2C5' },
    { offset: 0.8, color: '#B7BFC4' },
    { offset: 0.92, color: '#90A25D' },
    { offset: 1, color: '#536437' },
  ],
  hills: '#7E924F',
} as const;

export const radius = {
  tile: 14,
  card: 20,
  header: 36,
  pill: 999,
} as const;

export const shadow = {
  tile: '0px 2px 4px rgba(0, 0, 0, 0.35), 0px 8px 20px rgba(0, 0, 0, 0.4)',
  header: '0px 14px 34px rgba(0, 0, 0, 0.5)',
  dock: '0px 10px 30px rgba(0, 0, 0, 0.55)',
  accent: '0px 6px 20px rgba(29, 117, 253, 0.55), 0px 2px 6px rgba(29, 117, 253, 0.4)',
  glass: '0px 4px 14px rgba(0, 0, 0, 0.22)',
  lens: '0px 18px 44px rgba(0, 0, 0, 0.65), 0px 4px 10px rgba(0, 0, 0, 0.45)',
} as const;

/** Frosted background blur. Web only; native falls back to the translucent fill. */
export const backdrop = (px: number) =>
  Platform.OS === 'web' ? ({ backdropFilter: `blur(${px}px) saturate(160%)` } as object) : null;

export const fonts = Platform.select({
  ios: { sans: 'System' },
  web: { sans: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif' },
  default: { sans: 'sans-serif' },
});

export const canvas = {
  gap: 10,
  padding: 16,
  dotSpacing: 18,
  dotRadius: 1,
  // Target tile width; on a ~390pt phone this gives 4 columns and ~30 tiles in view.
  targetTileWidthPhone: 88,
  targetTileWidthWide: 150,
  minScale: 0.35,
  maxScale: 3,
} as const;

/** Hold-to-bulge: a balloon pushes the canvas up from behind, under the finger. */
export const bulge = {
  /** Balloon radius in points, and its cap as a share of the canvas width. */
  radius: 130,
  maxRadiusRatio: 0.34,
  /** Magnification at the balloon's centre. */
  zoom: 1.8,
  /** How far above the fingertip the balloon's centre sits, in radii (the finger rests near its lower edge). */
  lift: 0.35,
  holdMs: Platform.OS === 'web' ? 600 : 1000,
  hoverMs: 600,
} as const;
