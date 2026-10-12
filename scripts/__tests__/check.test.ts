/**
 * The content checker must pass on the real course and catch every class of mistake it is
 * responsible for. Each case breaks a copy of the real content in one specific way.
 */
import type { Exercise, Unit } from '../../src/core/content/schema';
import { checkContent } from '../lib/check';
import { loadContent, type LoadedContent } from '../lib/load';

const original = loadContent();

function errorsAfter(mutate: (unit: Unit) => void): string[] {
  const copy: LoadedContent = { ...original, issues: [], units: structuredClone(original.units) };
  mutate(copy.units[0]!);
  return checkContent(copy)
    .filter((i) => i.severity === 'error')
    .map((i) => `${i.path}: ${i.message}`);
}

function findExercise<T extends Exercise['type']>(
  unit: Unit,
  type: T,
): Extract<Exercise, { type: T }> {
  for (const lesson of unit.lessons) {
    const ex = lesson.exercises.find((e) => e.type === type);
    if (ex) return ex as Extract<Exercise, { type: T }>;
  }
  throw new Error(`no ${type} exercise in ${unit.id}`);
}

describe('content check', () => {
  it('real content has no errors', () => {
    const errors = checkContent(original).filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('catches words above the level', () => {
    const errors = errorsAfter((u) => {
      u.texts[0]!.lines[0]!.en = 'Good morning! Are you the new architect?';
    });
    expect(errors.join('\n')).toMatch(/"architect" is above the level/);
  });

  it('accepts inflected forms of known words', () => {
    const errors = errorsAfter((u) => {
      u.texts[0]!.lines[0]!.en = 'Good morning! Are you the new designers?';
    });
    expect(errors).toEqual([]);
  });

  it('catches an answer index out of range', () => {
    const errors = errorsAfter((u) => {
      findExercise(u, 'translate_choice').answer = 7;
    });
    expect(errors.join('\n')).toMatch(/answer index 7 out of range/);
  });

  it('catches a gap count mismatch', () => {
    const errors = errorsAfter((u) => {
      findExercise(u, 'fill_gap').text = 'No gaps here.';
    });
    expect(errors.join('\n')).toMatch(/no ___ gap/);
  });

  it('catches Cyrillic in English and Latin homoglyphs in Russian', () => {
    const errors = errorsAfter((u) => {
      const ex = findExercise(u, 'type_translation');
      ex.answers[0] = 'Тhank you!';
      ex.explanation = 'Сначала пpивет.';
    });
    const text = errors.join('\n');
    expect(text).toMatch(/Cyrillic letters in English text/);
    expect(text).toMatch(/mixed Latin\/Cyrillic/);
  });

  it('catches a transcription that disagrees with CMUdict', () => {
    const errors = errorsAfter((u) => {
      u.words.find((w) => w.id === 'teacher')!.ipa = 'ˈtiːtɚ';
    });
    expect(errors.join('\n')).toMatch(/consonants differ from CMUdict/);
  });

  it('catches a wrong stress mark', () => {
    const errors = errorsAfter((u) => {
      u.words.find((w) => w.id === 'hello')!.ipa = 'ˈhəloʊ';
    });
    expect(errors.join('\n')).toMatch(/stress differs from CMUdict/);
  });

  it('catches a sample answer that fails its own writing criteria', () => {
    const errors = errorsAfter((u) => {
      findExercise(u, 'write').samples.push('Hi! I from Kazan.');
    });
    expect(errors.join('\n')).toMatch(/sample answer fails the checker/);
  });

  it('catches a correction that is not among the options', () => {
    const errors = errorsAfter((u) => {
      const ex = findExercise(u, 'error_correction');
      ex.options = ex.options.filter((o) => o !== ex.correction).concat('xyz');
    });
    expect(errors.join('\n')).toMatch(/options must include the correction/);
  });

  it('catches duplicate exercise ids and broken text references', () => {
    const errors = errorsAfter((u) => {
      const [a, b] = u.lessons[0]!.exercises;
      b!.id = a!.id;
      u.lessons[4]!.textId = 'a1.u01.missing';
    });
    const text = errors.join('\n');
    expect(text).toMatch(/duplicate id/);
    expect(text).toMatch(/unknown text "a1.u01.missing"/);
  });

  it('requires all four skills in a unit', () => {
    const errors = errorsAfter((u) => {
      for (const l of u.lessons) l.exercises = l.exercises.filter((e) => e.type !== 'write');
    });
    expect(errors.join('\n')).toMatch(/unit has no writing exercise/);
  });
});
