import { longestStreak } from '../streak';
import { summarizeWeek, weekDays, weekStart } from '../week';

describe('weeks', () => {
  it('start on Monday', () => {
    expect(weekStart('2026-10-12')).toBe('2026-10-12'); // Monday
    expect(weekStart('2026-10-13')).toBe('2026-10-12');
    expect(weekStart('2026-10-18')).toBe('2026-10-12'); // Sunday
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
  });

  it('have seven days and cross month ends', () => {
    expect(weekDays('2026-10-26')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('are summarized from daily rows', () => {
    const rows = [
      { day: '2026-10-12', xp: 20, lessons: 1, reviews: 0, seconds: 300 },
      { day: '2026-10-14', xp: 30, lessons: 1, reviews: 12, seconds: 600 },
      { day: '2026-10-13', xp: 0, lessons: 0, reviews: 0, seconds: 0 },
      { day: '2026-10-20', xp: 99, lessons: 9, reviews: 9, seconds: 9999 }, // next week
    ];
    expect(summarizeWeek('2026-10-12', rows, 40, { n: 20, correct: 17 })).toEqual({
      start: '2026-10-12',
      xp: 50,
      activeDays: 2,
      lessons: 2,
      reviews: 12,
      minutes: 15,
      accuracy: 0.85,
      previousXp: 40,
    });
  });

  it('report no accuracy without answers', () => {
    expect(summarizeWeek('2026-10-12', [], 0, { n: 0, correct: 0 }).accuracy).toBeNull();
  });
});

describe('longestStreak', () => {
  const set = (...d: string[]) => new Set(d);
  it('finds the longest run, bridging frozen days without counting them', () => {
    const active = set('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06');
    expect(longestStreak(active, set())).toBe(3);
    expect(longestStreak(active, set('2026-10-04'))).toBe(5);
  });
  it('is zero without activity', () => {
    expect(longestStreak(set(), set())).toBe(0);
  });
});
