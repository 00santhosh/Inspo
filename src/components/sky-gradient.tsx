import { StyleSheet } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { sky } from '@/theme/tokens';

/** Sky-to-hills backdrop for the header card, stretched to fill its parent. */
export function SkyGradient() {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          {sky.stops.map((s) => (
            <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </LinearGradient>
        {/* Soft blobs read as out-of-focus hills and a bright patch of haze. */}
        <RadialGradient id="hill" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={sky.hills} stopOpacity={0.85} />
          <Stop offset="1" stopColor={sky.hills} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="haze" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill="url(#sky)" />
      <Ellipse cx={62} cy={58} rx={46} ry={16} fill="url(#haze)" />
      <Ellipse cx={8} cy={96} rx={40} ry={16} fill="url(#hill)" />
      <Ellipse cx={92} cy={100} rx={36} ry={13} fill="url(#hill)" />
    </Svg>
  );
}
