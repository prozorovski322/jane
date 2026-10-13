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
  | 'book'
  | 'path'
  | 'sun'
  | 'target'
  | 'user'
  | 'search'
  | 'star'
  | 'star-filled'
  | 'plus'
  | 'cards'
  | 'chevron-right'
  | 'back'
  | 'trash'
  | 'flame'
  | 'snow'
  | 'sliders'
  | 'lock'
  | 'trophy';

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
  path: (
    <>
      <Circle cx={6} cy={18} r={2.5} />
      <Circle cx={18} cy={6} r={2.5} />
      <Path d="M8.5 18H15a3.5 3.5 0 000-7H9a3.5 3.5 0 010-7h6.5" />
    </>
  ),
  sun: (
    <>
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  target: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={12} r={5} />
      <Circle cx={12} cy={12} r={1} />
    </>
  ),
  user: (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21a8 8 0 0116 0" />
    </>
  ),
  search: (
    <>
      <Circle cx={10.5} cy={10.5} r={6.5} />
      <Path d="M15.5 15.5L21 21" />
    </>
  ),
  star: <Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  'star-filled': (
    <Path
      d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
      fill="currentColor"
    />
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  cards: (
    <>
      <Rect x={3} y={7} width={13} height={14} rx={2} />
      <Path d="M8 3h11a2 2 0 012 2v12" />
    </>
  ),
  'chevron-right': <Path d="M9 5l7 7-7 7" />,
  back: <Path d="M19 12H5M11 5.5L4.5 12l6.5 6.5" />,
  trash: <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  flame: (
    <Path d="M12 21c-4 0-7-2.7-7-6.5 0-3.4 2.6-5.2 3.6-8.5.4 2 1.6 3.2 2.9 3.6C11.8 6.6 13 4.2 15 3c-.4 2.6.6 4.5 2 6.3 1.3 1.6 2 3.3 2 5.2C19 18.3 16 21 12 21z" />
  ),
  snow: <Path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 2 3-2M9 20l3-2 3 2" />,
  sliders: (
    <>
      <Path d="M4 7h8M18 7h2M4 12h2M12 12h8M4 17h10M20 17h0" />
      <Circle cx={15} cy={7} r={2.2} />
      <Circle cx={9} cy={12} r={2.2} />
      <Circle cx={17} cy={17} r={2.2} />
    </>
  ),
  lock: (
    <>
      <Rect x={5} y={11} width={14} height={10} rx={2.5} />
      <Path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  trophy: (
    <>
      <Path d="M8 4h8v6a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 14v4M8.5 21h7M9.5 18h5" />
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
      // `currentColor` in filled icons resolves to this.
      color={color}
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </Svg>
  );
}
