import { canvas as tokens } from '@/theme/tokens';
import type { Item } from '@/lib/types';

export type TileRect = { id: string; x: number; y: number; w: number; h: number };

export type CanvasLayout = {
  tiles: TileRect[];
  width: number;
  height: number;
  columnWidth: number;
};

/** Tile height as a multiple of its width. Clamped so no tile gets too tall or too flat. */
export function tileAspect(item: Item): number {
  switch (item.kind) {
    case 'note':
      return 1.05;
    case 'voice':
      return 0.72;
    case 'link':
      return 1.15;
    default: {
      const r = item.width && item.height ? item.height / item.width : 1;
      return Math.min(1.5, Math.max(0.7, r));
    }
  }
}

/**
 * Tightly packed masonry over a world wider than the viewport, so the canvas can be
 * panned in both directions. Column count is chosen so the world's aspect ratio
 * roughly matches the viewport's.
 */
export function layoutCanvas(items: Item[], viewportWidth: number, viewportHeight: number): CanvasLayout {
  const { gap, padding } = tokens;
  const target = viewportWidth < 600 ? tokens.targetTileWidthPhone : tokens.targetTileWidthWide;
  const viewportCols = Math.max(3, Math.round((viewportWidth - padding * 2) / target));
  const columnWidth = (viewportWidth - padding * 2 - gap * (viewportCols - 1)) / viewportCols;

  const avgHeight = columnWidth * 1.05 + gap;
  const idealCols = Math.sqrt(
    (items.length * avgHeight * viewportWidth) / ((columnWidth + gap) * Math.max(1, viewportHeight)),
  );
  const columns = Math.max(viewportCols, Math.ceil(idealCols));

  // Tightly packed: every tile goes in the shortest column, flush against its neighbours.
  const heights = Array.from({ length: columns }, () => padding);
  const tiles: TileRect[] = [];

  for (const item of items) {
    let col = 0;
    for (let c = 1; c < columns; c++) if (heights[c] < heights[col]) col = c;
    const w = columnWidth;
    const h = Math.round(columnWidth * tileAspect(item));
    const x = padding + col * (columnWidth + gap);
    const y = heights[col];
    tiles.push({ id: item.id, x, y, w, h });
    heights[col] += h + gap;
  }

  return {
    tiles,
    width: padding * 2 + columns * columnWidth + (columns - 1) * gap,
    height: Math.max(...heights, 0) + padding,
    columnWidth,
  };
}

/** Index of the tile containing the world point (x, y), or -1. */
export function hitIndex(tiles: TileRect[], x: number, y: number): number {
  'worklet';
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return i;
  }
  return -1;
}

export function hitTest(tiles: TileRect[], x: number, y: number): TileRect | undefined {
  'worklet';
  const i = hitIndex(tiles, x, y);
  return i < 0 ? undefined : tiles[i];
}
