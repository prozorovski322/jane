import { planReminders, REMINDER_TEXTS } from '../plan';

const now = new Date(2026, 9, 13, 15, 0); // 13 Oct 2026, 15:00 local

describe('planReminders', () => {
  it('schedules the chosen time for the coming days', () => {
    const plan = planReminders({ now, hour: 19, minute: 30, todayActive: false });
    expect(plan).toHaveLength(7);
    expect(plan[0]!.at).toEqual(new Date(2026, 9, 13, 19, 30));
    expect(plan[6]!.at).toEqual(new Date(2026, 9, 19, 19, 30));
  });

  it('skips today when the time has passed', () => {
    const plan = planReminders({ now, hour: 8, minute: 0, todayActive: false });
    expect(plan[0]!.at).toEqual(new Date(2026, 9, 14, 8, 0));
    expect(plan).toHaveLength(6);
  });

  it("leaves out today's reminder once the learner has studied", () => {
    const plan = planReminders({ now, hour: 19, minute: 0, todayActive: true });
    expect(plan[0]!.at).toEqual(new Date(2026, 9, 14, 19, 0));
  });

  it('uses friendly texts that never mention losing progress', () => {
    const plan = planReminders({ now, hour: 19, minute: 0, todayActive: false, days: 30 });
    expect(new Set(plan.map((p) => p.body)).size).toBeGreaterThan(2);
    for (const t of REMINDER_TEXTS)
      expect(t).not.toMatch(/серия|потер|пропуст|последн|срочно|!{2}/i);
  });

  it('is stable: the same day gets the same text', () => {
    const a = planReminders({ now, hour: 19, minute: 0, todayActive: false });
    const b = planReminders({ now, hour: 19, minute: 0, todayActive: false });
    expect(a.map((p) => p.body)).toEqual(b.map((p) => p.body));
  });
});
