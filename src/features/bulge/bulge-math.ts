import { bulge } from '@/theme/tokens';

/** A rectangle in world units (the canvas's own coordinate space). */
export type Rect = { x: number; y: number; w: number; h: number };

/** On-screen zoom for the held tile: as large as the limits allow, keeping its aspect ratio. */
export function heldZoom(screenW: number, screenH: number, viewW: number, viewH: number) {
  'worklet';
  const maxW = Math.min(viewW * bulge.maxWidthRatio, bulge.maxWidth);
  const maxH = Math.min(viewH * bulge.maxHeightRatio, bulge.maxHeight);
  const z = Math.min(maxW / screenW, maxH / screenH);
  return Math.min(bulge.maxZoom, Math.max(bulge.minZoom, z));
}

/**
 * Where the held tile sits on screen: centred on the finger horizontally, its bottom
 * edge just above the fingertip. Flips below the finger when there is no room above.
 */
export function heldPlacement(
  fx: number,
  fy: number,
  w: number,
  h: number,
  viewW: number,
  minTop: number,
): { left: number; top: number } {
  'worklet';
  const left = Math.min(Math.max(fx - w / 2, 12), viewW - w - 12);
  const above = fy - bulge.fingerGap - h;
  const top = above < minTop ? fy + bulge.fingerGap : above;
  return { left, top };
}

export function lerpRect(a: Rect, b: Rect, t: number): Rect {
  'worklet';
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  };
}

/**
 * Push-and-scale for a neighbouring tile, so neighbours hug the bulge. A tile that
 * overlaps the held tile moves straight away from it just far enough to clear it (plus
 * a small gap); every nearby tile also gets a gentle nudge that fades with distance, so
 * the next ring out makes room too. The nearest tiles shrink a little.
 *
 * `held` is the held tile's current rect and `base` its normal rect, both in world
 * units; `g` is the bulge strength (0 to 1) and `scale` the canvas zoom.
 */
export function displace(
  tile: Rect,
  held: Rect,
  base: Rect,
  g: number,
  scale: number,
): { dx: number; dy: number; k: number } {
  'worklet';
  if (g <= 0.001 || held.w <= 0) return { dx: 0, dy: 0, k: 1 };
  const gap = (g * bulge.margin) / scale;
  const hcx = held.x + held.w / 2;
  const hcy = held.y + held.h / 2;
  const vx = tile.x + tile.w / 2 - hcx;
  const vy = tile.y + tile.h / 2 - hcy;
  // Distance in an ellipse around the held tile: 1 at its edge.
  const ux = vx / (held.w / 2 + gap);
  const uy = vy / (held.h / 2 + gap);
  const rho = Math.hypot(ux, uy);
  const beyond = Math.max(0, rho - 1);
  const fall = Math.exp(-(beyond * beyond) / (bulge.falloff * bulge.falloff));
  const k = 1 - g * bulge.shrink * fall;
  // Direction away from the held tile (straight down if exactly underneath).
  const nx = rho > 0.001 ? ux / rho : 0;
  const ny = rho > 0.001 ? uy / rho : 1;

  // Shortest move along (nx, ny) that separates the shrunk tile from the held tile.
  const hw = (tile.w * k) / 2;
  const hh = (tile.h * k) / 2;
  const L = held.x - gap;
  const R = held.x + held.w + gap;
  const T = held.y - gap;
  const B = held.y + held.h + gap;
  const cx = hcx + vx;
  const cy = hcy + vy;
  let clear = 0;
  if (cx + hw > L && cx - hw < R && cy + hh > T && cy - hh < B) {
    clear = Number.MAX_VALUE;
    if (nx > 0.001) clear = Math.min(clear, (R + hw - cx) / nx);
    if (nx < -0.001) clear = Math.min(clear, (cx + hw - L) / -nx);
    if (ny > 0.001) clear = Math.min(clear, (B + hh - cy) / ny);
    if (ny < -0.001) clear = Math.min(clear, (cy + hh - T) / -ny);
    if (clear === Number.MAX_VALUE) clear = 0;
  }

  // Gentle nudge proportional to how much the held tile grew, for the next ring out.
  const grow = Math.max(held.w - base.w, held.h - base.h) / 2;
  const nudge = grow * bulge.push * fall;
  const t = Math.max(clear, nudge);
  return { dx: nx * t, dy: ny * t, k };
}
