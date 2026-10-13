/**
 * Jane's mascot: Bubble, a speech bubble with a face. Four emotions, used sparingly — on
 * results, empty states and the welcome screen, never on every screen.
 */
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { useTheme } from '../theme/ThemeProvider';

export type MascotEmotion = 'joy' | 'support' | 'think' | 'celebrate';

const PUPIL = '#12332F';

export function Mascot({
  emotion = 'joy',
  size = 96,
  label,
}: {
  emotion?: MascotEmotion;
  size?: number;
  /** Accessible description; the mascot is decorative (hidden from screen readers) without it. */
  label?: string;
}) {
  const { colors } = useTheme();
  const white = colors.onPrimary;
  const closedEyes = emotion === 'celebrate' || emotion === 'joy';
  // Pupils look up and to the right when thinking.
  const px = emotion === 'think' ? 2.5 : 0;
  const py = emotion === 'think' ? -2.5 : 0;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* Body: a rounded speech bubble with a tail at the bottom left. */}
      <Rect x={12} y={16} width={96} height={72} rx={34} fill={colors.primary} />
      <Path d="M30 82c0 10-5 18-14 24 12 0 24-4 32-12z" fill={colors.primary} />

      {/* Eyes */}
      {closedEyes ? (
        <G stroke={white} strokeWidth={4.5} strokeLinecap="round" fill="none">
          <Path d={emotion === 'celebrate' ? 'M36 54q8-12 16 0' : 'M36 56q8-10 16 0'} />
          <Path d={emotion === 'celebrate' ? 'M68 54q8-12 16 0' : 'M68 56q8-10 16 0'} />
        </G>
      ) : (
        <G>
          <Circle cx={44} cy={52} r={9} fill="#FFFFFF" />
          <Circle cx={76} cy={52} r={9} fill="#FFFFFF" />
          <Circle cx={44 + px} cy={53 + py} r={4.5} fill={PUPIL} />
          <Circle cx={76 + px} cy={53 + py} r={4.5} fill={PUPIL} />
        </G>
      )}

      {/* Raised eyebrow when thinking */}
      {emotion === 'think' && (
        <Path
          d="M68 38q8-5 16-1"
          stroke={white}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Cheeks */}
      {(emotion === 'joy' || emotion === 'celebrate' || emotion === 'support') && (
        <G fill={colors.accent} opacity={0.55}>
          <Circle cx={32} cy={68} r={5} />
          <Circle cx={88} cy={68} r={5} />
        </G>
      )}

      {/* Mouth */}
      {emotion === 'celebrate' ? (
        <Path d="M46 66q14 18 28 0z" fill={white} />
      ) : emotion === 'think' ? (
        <Path d="M50 70h20" stroke={white} strokeWidth={4.5} strokeLinecap="round" fill="none" />
      ) : (
        <Path
          d={emotion === 'joy' ? 'M46 66q14 14 28 0' : 'M50 68q10 8 20 0'}
          stroke={white}
          strokeWidth={4.5}
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Extras */}
      {emotion === 'celebrate' && (
        <G>
          <Circle cx={14} cy={20} r={3.5} fill={colors.accent} />
          <Circle cx={104} cy={14} r={3.5} fill={colors.xp} />
          <Rect
            x={4}
            y={46}
            width={7}
            height={7}
            rx={1.5}
            fill={colors.info}
            transform="rotate(20 7 49)"
          />
          <Rect
            x={108}
            y={42}
            width={7}
            height={7}
            rx={1.5}
            fill={colors.accent}
            transform="rotate(-20 111 45)"
          />
          <Path d="M92 6l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill={colors.xp} />
        </G>
      )}
      {emotion === 'support' && (
        <Path
          d="M100 14c-3-5-11-3-11 3 0 5 7 9 11 12 4-3 11-7 11-12 0-6-8-8-11-3z"
          fill={colors.accent}
        />
      )}
      {emotion === 'think' && (
        <G>
          <Circle cx={96} cy={10} r={3} fill={colors.textMuted} />
          <Circle cx={104} cy={4} r={2} fill={colors.textMuted} />
        </G>
      )}
    </Svg>
  );
}
