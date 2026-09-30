import { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

/** Point on a circle; angles in degrees, clockwise from 3 o'clock (SVG convention). */
function polar(c: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
}

function arc(c: number, r: number, from: number, to: number) {
  const a = polar(c, r, from);
  const b = polar(c, r, to);
  return { d: `M ${a.x} ${a.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x} ${b.y}`, a, b };
}

type Streak = { id: string; from: number; to: number; color: string; width: number; opacity: number };

// Rim highlights: a long white key light top-left, a cool fill bottom-right, a warm kick on the right.
const STREAKS: Streak[] = [
  { id: 'w1', from: 196, to: 252, color: '#FFFFFF', width: 2.2, opacity: 1 },
  { id: 'w2', from: 262, to: 274, color: '#FFFFFF', width: 1.6, opacity: 0.85 },
  { id: 'b1', from: 28, to: 70, color: '#8FC4FF', width: 1.8, opacity: 0.9 },
  { id: 'o1', from: 330, to: 352, color: '#FFB066', width: 1.6, opacity: 0.85 },
  { id: 'o2', from: 118, to: 128, color: '#FFB066', width: 1.2, opacity: 0.6 },
];

/**
 * The lens's glass edge, drawn over the magnified content. Plain SVG, no shaders:
 * the red/blue fringe is approximated with two offset tinted rings, not per-pixel
 * chromatic aberration.
 */
export const LensRim = memo(function LensRim({ size }: { size: number }) {
  const c = size / 2;
  const r = c;

  return (
    <Svg width={size} height={size} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <RadialGradient id="lens-glow" cx={c} cy={c} r={r} gradientUnits="userSpaceOnUse">
          <Stop offset="0.72" stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="0.9" stopColor="#FFFFFF" stopOpacity={0.12} />
          <Stop offset="0.97" stopColor="#FFFFFF" stopOpacity={0.32} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.5} />
        </RadialGradient>
        <RadialGradient
          id="lens-spec"
          cx={c * 0.62}
          cy={c * 0.5}
          rx={c * 0.55}
          ry={c * 0.32}
          gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        {STREAKS.map((s) => {
          const { a, b } = arc(c, r - 1.2, s.from, s.to);
          return (
            <LinearGradient key={s.id} id={`streak-${s.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={s.color} stopOpacity={0} />
              <Stop offset="0.5" stopColor={s.color} stopOpacity={s.opacity} />
              <Stop offset="1" stopColor={s.color} stopOpacity={0} />
            </LinearGradient>
          );
        })}
      </Defs>

      {/* Soft inner glow toward the edge, plus a faint specular sheen. */}
      <Circle cx={c} cy={c} r={r} fill="url(#lens-glow)" />
      <Ellipse cx={c * 0.62} cy={c * 0.5} rx={c * 0.55} ry={c * 0.32} fill="url(#lens-spec)" />

      {/* Chromatic fringe: red pushed down-right, blue up-left. */}
      <Circle cx={c + 0.9} cy={c + 0.7} r={r - 3} stroke="rgba(255, 64, 64, 0.2)" strokeWidth={2.4} fill="none" />
      <Circle cx={c - 0.9} cy={c - 0.7} r={r - 3} stroke="rgba(64, 128, 255, 0.2)" strokeWidth={2.4} fill="none" />

      {/* Glass rim: bright inner line, dark hairline so it reads on a light canvas. */}
      <Circle cx={c} cy={c} r={r - 2.2} stroke="rgba(0, 0, 0, 0.06)" strokeWidth={1} fill="none" />
      <Circle cx={c} cy={c} r={r - 1} stroke="rgba(255, 255, 255, 0.95)" strokeWidth={1.6} fill="none" />
      <Circle cx={c} cy={c} r={r - 0.25} stroke="rgba(0, 0, 0, 0.45)" strokeWidth={0.6} fill="none" />

      {STREAKS.map((s) => (
        <Path
          key={s.id}
          d={arc(c, r - 1.2, s.from, s.to).d}
          stroke={`url(#streak-${s.id})`}
          strokeWidth={s.width}
          strokeLinecap="round"
          fill="none"
        />
      ))}
    </Svg>
  );
});
