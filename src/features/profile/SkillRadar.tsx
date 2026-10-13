import { View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/ui/theme/ThemeProvider';
import { fonts } from '@/ui/theme/tokens';

import { SKILL_LABEL, type SkillStat } from '../progress/insights';

// Wide view box: labels like «Произношение» sit left and right of the chart.
const W = 360;
const H = 270;
const CX = W / 2;
const CY = H / 2 + 4;
const R = 78;

function point(i: number, n: number, r: number): [number, number] {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

/**
 * Accuracy per skill as a radar. The chart is decorative for screen readers: the same numbers are
 * in its accessible label (and listed next to it on screen).
 */
export function SkillRadar({ stats }: { stats: readonly SkillStat[] }) {
  const { colors } = useTheme();
  const n = stats.length;
  const values = stats.map((s) => s.accuracy ?? 0);
  const shape = values.map((v, i) => point(i, n, R * Math.max(0.04, v)).join(',')).join(' ');
  const summary = stats
    .map(
      (s) =>
        `${SKILL_LABEL[s.skill]}: ${s.accuracy === null ? 'нет данных' : `${Math.round(s.accuracy * 100)}%`}`,
    )
    .join(', ');

  return (
    <View
      accessible
      aria-label={`Точность по навыкам. ${summary}`}
      style={{ width: '100%', aspectRatio: W / H }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <Polygon
            key={k}
            points={stats.map((_, i) => point(i, n, R * k).join(',')).join(' ')}
            fill="none"
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}
        {stats.map((_, i) => {
          const [x, y] = point(i, n, R);
          return (
            <Line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke={colors.border} strokeWidth={1} />
          );
        })}
        <Polygon
          points={shape}
          fill={colors.primary}
          fillOpacity={0.25}
          stroke={colors.primary}
          strokeWidth={2.5}
        />
        {values.map((v, i) => {
          const [x, y] = point(i, n, R * Math.max(0.04, v));
          return <Circle key={i} cx={x} cy={y} r={3.5} fill={colors.primary} />;
        })}
        {stats.map((s, i) => {
          const [x, y] = point(i, n, R + 12);
          return (
            <SvgText
              key={s.skill}
              x={x}
              y={y + (y < CY - R ? -2 : y > CY + R / 2 ? 12 : 4)}
              fontSize={12}
              fontFamily={fonts.medium}
              fill={s.accuracy === null ? colors.textMuted : colors.text}
              textAnchor={Math.abs(x - CX) < 8 ? 'middle' : x > CX ? 'start' : 'end'}
            >
              {SKILL_LABEL[s.skill]}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
