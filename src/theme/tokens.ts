import { Platform } from 'react-native';

// Values follow the written design direction. Revisit against
// design/inspiration_canvas_hifi_v2.png once it is in the repo.
export const colors = {
  canvas: '#F7F6F3',
  dot: '#D9D6CF',
  surface: '#FFFFFF',
  text: '#16161A',
  textSecondary: '#6B6B73',
  chip: '#FFFFFF',
  chipActive: '#16161A',
  chipActiveText: '#FFFFFF',
  hairline: 'rgba(22, 22, 26, 0.08)',
  noteYellow: '#FFF6D6',
  voice: '#EEF1FF',
  voiceAccent: '#5B6CFF',
} as const;

export const radius = {
  tile: 12,
  chip: 999,
  dock: 28,
} as const;

export const shadow = {
  tile: '0px 1px 2px rgba(20, 20, 30, 0.06), 0px 4px 12px rgba(20, 20, 30, 0.07)',
  dock: '0px 8px 28px rgba(20, 20, 30, 0.16)',
  lens: '0px 14px 36px rgba(10, 10, 20, 0.28), 0px 3px 8px rgba(10, 10, 20, 0.18)',
} as const;

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

export const lens = {
  diameter: 176,
  magnification: 2.6,
  holdMs: Platform.OS === 'web' ? 600 : 1000,
  hoverMs: 600,
} as const;
