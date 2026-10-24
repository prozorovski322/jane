import { getCourse } from '@/core/content';
import { learningOverview } from '../overview';

it('uses real lesson completion and excludes tests, practice and unknown ids', () => {
  const course = getCourse();
  const first = course.levels[0]!.units[0]!;
  const lesson = first.lessons[0]!.id;
  const result = learningOverview(
    course,
    new Set([lesson, `${first.id}.test`, 'practice.study-campus', 'unknown.lesson']),
  );
  expect(result.done).toBe(1);
  expect(result.totalDone).toBe(1);
  expect(result.total).toBe(course.levels[0]!.units.reduce((n, u) => n + u.lessons.length, 0));
  expect(result.ratio).toBe(1 / result.total);
  expect(result.next?.node.id).not.toBe(lesson);
});

it('shows full completion without inventing another lesson', () => {
  const course = getCourse();
  const ids = course.levels.flatMap((l) =>
    l.units.flatMap((u) => [...u.lessons.map((ls) => ls.id), `${u.id}.test`]),
  );
  const result = learningOverview(course, new Set(ids));
  expect(result.next).toBeNull();
  expect(result.ratio).toBe(1);
});
