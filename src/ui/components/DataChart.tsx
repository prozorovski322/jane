/**
 * A small line or bar chart for "describe the data" tasks (IELTS Writing Task 1). Drawn with SVG
 * at the width of its container; screen readers get the numbers as text.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { Chart } from '@/core/content/schema';

import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { AppText } from './AppText';

const HEIGHT = 200;
const PAD = { top: 10, right: 20, bottom: 22, left: 34 };

/** A round axis maximum and step: 0, 10, 20… or 0, 25, 50… covering `max` in about four steps. */
export function axisScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 1, step: 1 };
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough)!;
  return { top: Math.ceil(max / step) * step, step };
}

const format = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/** The chart as text for screen readers and for the tests. */
export function describeChart(c: Chart): string {
  const unit = c.unit === '%' ? '%' : ` ${c.unit}`;
  const rows = c.series.map(
    (s) =>
      `${s.name}: ${s.values
        .map(
          (v, i) =>
            `${c.labels[i]}${c.forecastFrom !== undefined && i >= c.forecastFrom ? ' (прогноз)' : ''} — ${format(v)}${unit}`,
        )
        .join(', ')}`,
  );
  return [c.title, ...rows].join('. ');
}

export function DataChart({ chart }: { chart: Chart }) {
  const { colors, radius, space } = useTheme();
  const [width, setWidth] = useState(0);
  const palette = [colors.primary, colors.accent, colors.xp, colors.info];

  const n = chart.labels.length;
  const forecast = chart.forecastFrom ?? n;
  const { top, step } = axisScale(Math.max(...chart.series.flatMap((s) => s.values)));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + plotH * (1 - v / top);
  // Lines run from the first label to the last; bars sit in the middle of equal slots.
  const slot = plotW / n;
  const x = (i: number) =>
    chart.kind === 'line'
      ? PAD.left + (n > 1 ? (i * plotW) / (n - 1) : plotW / 2)
      : PAD.left + slot * (i + 0.5);

  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);

  const path = (values: number[], from: number, to: number) =>
    values
      .slice(from, to + 1)
      .map((v, k) => `${k === 0 ? 'M' : 'L'}${x(from + k)},${y(v)}`)
      .join(' ');

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: space.sm,
        },
      ]}
      accessible
      role="img"
      aria-label={describeChart(chart)}
    >
      <AppText variant="bodyStrong">{chart.title}</AppText>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} aria-hidden>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {ticks.map((v) => (
              <Line
                key={`grid${v}`}
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(v)}
                y2={y(v)}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}
            {ticks.map((v) => (
              <SvgText
                key={`tick${v}`}
                x={PAD.left - 6}
                y={y(v) + 4}
                fontSize={11}
                fontFamily={fonts.regular}
                fill={colors.textMuted}
                textAnchor="end"
              >
                {format(v)}
              </SvgText>
            ))}
            {chart.labels.map((label, i) => (
              <SvgText
                key={`label${i}`}
                x={x(i)}
                y={HEIGHT - 6}
                fontSize={11}
                fontFamily={fonts.regular}
                fill={colors.textMuted}
                textAnchor="middle"
              >
                {label}
              </SvgText>
            ))}

            {chart.kind === 'line' &&
              chart.series.map((s, si) => (
                <G key={s.name}>
                  <Path
                    d={path(s.values, 0, Math.min(forecast - 1, n - 1))}
                    stroke={palette[si]}
                    strokeWidth={2.5}
                    fill="none"
                  />
                  {forecast < n && (
                    <Path
                      d={path(s.values, forecast - 1, n - 1)}
                      stroke={palette[si]}
                      strokeWidth={2.5}
                      strokeDasharray="5,5"
                      fill="none"
                    />
                  )}
                  {s.values.map((v, i) => (
                    <Circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={palette[si]} />
                  ))}
                </G>
              ))}

            {chart.kind === 'bar' &&
              chart.series.map((s, si) => {
                const barW = (slot * 0.72) / chart.series.length;
                return s.values.map((v, i) => (
                  <Rect
                    key={`${s.name}${i}`}
                    x={PAD.left + slot * i + slot * 0.14 + barW * si}
                    y={y(v)}
                    width={Math.max(1, barW - 2)}
                    height={Math.max(0, PAD.top + plotH - y(v))}
                    fill={palette[si]}
                    opacity={i >= forecast ? 0.45 : 1}
                    rx={2}
                  />
                ));
              })}
          </Svg>
        )}
      </View>
      <View style={styles.legend} aria-hidden>
        {chart.series.map((s, si) => (
          <View key={s.name} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: palette[si] }]} />
            <AppText variant="small">{s.name}</AppText>
          </View>
        ))}
        <AppText variant="small" color="textMuted">
          {chart.unit === '%' ? 'в процентах' : chart.unit}
          {chart.forecastFrom !== undefined &&
            (chart.kind === 'line' ? ' · пунктир — прогноз' : ' · бледные столбцы — прогноз')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, borderWidth: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
});
