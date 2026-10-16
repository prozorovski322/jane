import { render, screen } from '@testing-library/react-native';

import { Chart } from '@/core/content/schema';

import { axisScale, DataChart, describeChart } from '../DataChart';

const chart = Chart.parse({
  kind: 'line',
  title: 'How people traveled to work',
  unit: '%',
  labels: ['2000', '2010', '2020', '2030'],
  forecastFrom: 3,
  series: [
    { name: 'car', values: [60, 58, 40, 33] },
    { name: 'bike', values: [5, 8, 28, 35] },
  ],
});

describe('DataChart', () => {
  it('picks a round axis covering the data', () => {
    expect(axisScale(65)).toEqual({ top: 80, step: 20 });
    expect(axisScale(35)).toEqual({ top: 40, step: 10 });
    expect(axisScale(4)).toEqual({ top: 4, step: 1 });
    expect(axisScale(0)).toEqual({ top: 1, step: 1 });
  });

  it('describes the numbers for screen readers, marking the forecast', () => {
    expect(describeChart(chart)).toBe(
      'How people traveled to work. car: 2000 — 60%, 2010 — 58%, 2020 — 40%, 2030 (прогноз) — 33%. bike: 2000 — 5%, 2010 — 8%, 2020 — 28%, 2030 (прогноз) — 35%',
    );
  });

  it('shows the title and the legend', async () => {
    await render(<DataChart chart={chart} />);
    expect(screen.getByText('How people traveled to work')).toBeOnTheScreen();
    // The legend repeats the description, so it is hidden from screen readers.
    const hidden = { includeHiddenElements: true };
    expect(screen.getByText('car', hidden)).toBeOnTheScreen();
    expect(screen.getByText(/пунктир — прогноз/, hidden)).toBeOnTheScreen();
  });

  it('rejects series that do not match the labels', () => {
    const bad = { ...chart, series: [{ name: 'car', values: [1, 2] }] };
    expect(Chart.safeParse(bad).success).toBe(false);
  });
});
