/**
 * Jane's own line icon set: 24×24 grid, 2px round strokes.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'close'
  | 'speaker'
  | 'speaker-slow'
  | 'bulb'
  | 'check'
  | 'cross'
  | 'mic'
  | 'keyboard'
  | 'eye'
  | 'arrow-right'
  | 'skip'
  | 'refresh'
  | 'book';

const paths: Record<IconName, React.ReactNode> = {
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  speaker: (
    <>
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <Path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />
    </>
  ),
  'speaker-slow': (
    <>
      <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <Path d="M15.5 10a2.5 2.5 0 010 4" />
      <Circle cx={19.5} cy={18} r={1.5} />
    </>
  ),
  bulb: (
    <>
      <Path d="M9 18h6M10 21h4" />
      <Path d="M12 3a6 6 0 00-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0012 3z" />
    </>
  ),
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  cross: <Path d="M7 7l10 10M17 7L7 17" />,
  mic: (
    <>
      <Rect x={9} y={3} width={6} height={11} rx={3} />
      <Path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
    </>
  ),
  keyboard: (
    <>
      <Rect x={2.5} y={6} width={19} height={12} rx={2.5} />
      <Path d="M6.5 10h1M10.5 10h1M14.5 10h1M8 14h8" />
    </>
  ),
  eye: (
    <>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <Circle cx={12} cy={12} r={3} />
    </>
  ),
  'arrow-right': <Path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" />,
  skip: <Path d="M5 6l7 6-7 6zM13 6l7 6-7 6z" />,
  refresh: (
    <>
      <Path d="M19.5 12a7.5 7.5 0 11-2.2-5.3" />
      <Path d="M19.5 4.5v4.5H15" />
    </>
  ),
  book: (
    <>
      <Path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z" />
      <Path d="M4 20.5A2.5 2.5 0 006.5 23H20v-5" />
    </>
  ),
};

export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </Svg>
  );
}
