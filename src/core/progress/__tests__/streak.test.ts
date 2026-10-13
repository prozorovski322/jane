import { addDays, dayOf, daysBetween, parseDay } from '../dates';
import { currentStreak, freezesEarned, freezesNeeded } from '../streak';
import { dailyGoalXp, sessionXp } from '../xp';

describe('dates', () => {
  it('formats local days and steps across month ends', () => {
    expect(dayOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-01', '2026-10-13')).toBe(12);
    expect(dayOf(parseDay('2026-10-13'))).toBe('2026-10-13');
  });
});

describe('currentStreak', () => {
  const s = (days: string[], frozen: string[] = []) =>
    currentStreak(new Set(days), new Set(frozen), '2026-10-13');

  it('counts consecutive active days ending today', () => {
    expect(s(['2026-10-11', '2026-10-12', '2026-10-13'])).toBe(3);
  });

  it("keeps yesterday's streak alive while today is still open", () => {
    expect(s(['2026-10-11', '2026-10-12'])).toBe(2);
  });

  it('breaks on a missed day', () => {
    expect(s(['2026-10-10', '2026-10-12', '2026-10-13'])).toBe(2);
  });

  it('bridges frozen days without counting them', () => {
    expect(s(['2026-10-10', '2026-10-13'], ['2026-10-11', '2026-10-12'])).toBe(2);
  });

  it('is zero with no activity', () => {
    expect(s([])).toBe(0);
  });
});

describe('freezes', () => {
  it('covers missed days when there are enough freezes', () => {
    expect(freezesNeeded('2026-10-10', '2026-10-13', 2)).toEqual(['2026-10-11', '2026-10-12']);
  });

  it('does nothing when the learner was active yesterday', () => {
    expect(freezesNeeded('2026-10-12', '2026-10-13', 2)).toEqual([]);
  });

  it('keeps freezes when there are not enough to save the streak', () => {
    expect(freezesNeeded('2026-10-05', '2026-10-13', 2)).toEqual([]);
  });

  it('awards one freeze per 7 days, up to the stock limit', () => {
    expect(freezesEarned(6, 7, 0)).toBe(1);
    expect(freezesEarned(7, 8, 0)).toBe(0);
    expect(freezesEarned(13, 14, 2)).toBe(0);
  });
});

describe('xp', () => {
  const base = {
    kind: 'lesson' as const,
    answered: 10,
    correctFirstTry: 8,
    accuracy: 0.8,
    passed: true,
  };

  it('rewards a lesson with a base and per correct answer', () => {
    expect(sessionXp(base)).toBe(18);
  });

  it('adds bonuses for great and perfect accuracy', () => {
    expect(sessionXp({ ...base, correctFirstTry: 9, accuracy: 0.9 })).toBe(10 + 9 + 3);
    expect(sessionXp({ ...base, correctFirstTry: 10, accuracy: 1 })).toBe(10 + 10 + 5);
  });

  it('adds a bonus only for a passed test', () => {
    expect(sessionXp({ ...base, kind: 'test' })).toBe(38);
    expect(sessionXp({ ...base, kind: 'test', passed: false })).toBe(18);
  });

  it('caps reviews and gives nothing for an empty session', () => {
    expect(sessionXp({ ...base, kind: 'review', correctFirstTry: 100 })).toBe(30);
    expect(sessionXp({ ...base, answered: 0 })).toBe(0);
  });

  it('maps daily minutes to a goal', () => {
    expect([5, 10, 15, 30].map(dailyGoalXp)).toEqual([10, 20, 30, 50]);
  });
});
