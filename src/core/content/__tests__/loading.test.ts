import { examUnitIds } from '@/features/exams/exam';

import {
  getCourse,
  getUnit,
  getUnitOutline,
  isKnownUnit,
  lessonTitle,
  loadUnits,
  unitIdOf,
} from '..';

describe('content loading', () => {
  it('resolves the unit of a lesson or exercise id', () => {
    expect(unitIdOf('a1.u01.l03.e05')).toBe('a1.u01');
    expect(unitIdOf('travel.u02.test')).toBe('travel.u02');
  });

  it('loads known units and ignores unknown ids', async () => {
    await expect(loadUnits(['a1.u01', 'a1.u01', 'nowhere.u01'])).resolves.toBeUndefined();
    expect(getUnit('a1.u01').id).toBe('a1.u01');
    expect(isKnownUnit('nowhere.u01')).toBe(false);
    expect(() => getUnit('nowhere.u01')).toThrow('Unknown unit');
  });

  it('gives titles from the outline without loading a unit', () => {
    const unit = getCourse().levels[1]!.units[0]!;
    expect(getUnitOutline(unit.id)?.title).toEqual(unit.title);
    expect(lessonTitle(unit.lessons[0]!.id)).toBe(unit.lessons[0]!.title);
    expect(lessonTitle(`${unit.id}.test`)).toBe(`Тест: ${unit.title.ru}`);
    expect(lessonTitle('a9.u01.l01')).toBeUndefined();
  });

  it('lists the units a test is assembled from', () => {
    const level = getCourse().levels.find((l) => l.level === 'A1')!;
    expect(examUnitIds('a1.exam')).toEqual(level.units.map((u) => u.id));
    expect(examUnitIds(`${level.modules[0]!.id}.test`)).toEqual(
      level.modules[0]!.units.map((u) => u.id),
    );
    const travel = getCourse().tracks.find((t) => t.id === 'travel')!;
    expect(examUnitIds('travel.exam')).toEqual(travel.units.map((u) => u.id));
    expect(examUnitIds('a1.u01.l01')).toEqual([]);
  });
});
