import { getCourse } from '@/core/content';

import { titleFor } from '../pageTitle';

describe('page titles', () => {
  it('names the sections, and the start page after the site', () => {
    expect(titleFor('/')).toBe('Jane — английский с нуля до C1');
    expect(titleFor('/dictionary')).toBe('Словарь — Jane');
    expect(titleFor('/settings')).toBe('Настройки — Jane');
  });

  it('names lessons, unit tests and level exams', () => {
    const unit = getCourse().levels[1]!.units[0]!;
    expect(titleFor(`/lesson/${unit.lessons[0]!.id}`)).toBe(`${unit.lessons[0]!.title} — Jane`);
    expect(titleFor(`/lesson/${unit.id}.test`)).toBe(`Тест: ${unit.title.ru} — Jane`);
    expect(titleFor('/lesson/b2.exam')).toBe('Экзамен B2 — Jane');
  });

  it('falls back to the site name for unknown addresses', () => {
    expect(titleFor('/nowhere')).toBe('Jane — английский с нуля до C1');
  });
});
