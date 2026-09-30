import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'image'
  | 'video'
  | 'link'
  | 'note'
  | 'voice'
  | 'plus'
  | 'grid'
  | 'search'
  | 'back'
  | 'bookmark'
  | 'sparkle';

function paths(name: IconName, stroke: object): ReactNode {
  switch (name) {
    case 'image':
      return (
        <>
          <Rect x={3} y={4} width={18} height={16} rx={3.5} {...stroke} />
          <Circle cx={9} cy={10} r={1.6} {...stroke} />
          <Path d="M4 18l5-5 4 4 3-3 4 4" {...stroke} />
        </>
      );
    case 'video':
      return (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={3.5} {...stroke} />
          <Path d="M10 9.5v5l4.2-2.5z" {...stroke} />
        </>
      );
    case 'link':
      return (
        <>
          <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" {...stroke} />
          <Path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" {...stroke} />
        </>
      );
    case 'note':
      return (
        <>
          <Rect x={4} y={3} width={16} height={18} rx={3.5} {...stroke} />
          <Path d="M8 8h8M8 12h8M8 16h5" {...stroke} />
        </>
      );
    case 'voice':
      return (
        <>
          <Rect x={9} y={3} width={6} height={11} rx={3} {...stroke} />
          <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" {...stroke} />
        </>
      );
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...stroke} />;
    case 'grid':
      return (
        <>
          <Rect x={4} y={4} width={7} height={9} rx={2} {...stroke} />
          <Rect x={13} y={4} width={7} height={6} rx={2} {...stroke} />
          <Rect x={4} y={15} width={7} height={5} rx={2} {...stroke} />
          <Rect x={13} y={12} width={7} height={8} rx={2} {...stroke} />
        </>
      );
    case 'search':
      return (
        <>
          <Circle cx={11} cy={11} r={6.5} {...stroke} />
          <Path d="M16 16l4 4" {...stroke} />
        </>
      );
    case 'back':
      return <Path d="M19 12H5M11 6l-6 6 6 6" {...stroke} />;
    case 'bookmark':
      return <Path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" {...stroke} />;
    case 'sparkle':
      return <Path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" {...stroke} />;
  }
}

export function Icon({
  name,
  size = 24,
  color = '#FFFFFF',
  strokeWidth = 1.8,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const stroke = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {paths(name, stroke)}
    </Svg>
  );
}
