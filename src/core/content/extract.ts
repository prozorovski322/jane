/**
 * Extracts the English and Russian strings an exercise shows to the learner. Used to derive the
 * words an exercise trains and by the content checker (language and vocabulary-level checks).
 */
import type { Exercise } from './schema';

export interface ExerciseStrings {
  en: string[];
  ru: string[];
}

const CYRILLIC = /[Ѐ-ӿ]/;

export function hasCyrillic(s: string): boolean {
  return CYRILLIC.test(s);
}

/** Fills `___` gaps with the first accepted answer of each gap. */
export function fillGaps(text: string, answers: readonly (readonly string[])[]): string {
  let i = 0;
  return text.replace(/___/g, () => answers[i++]?.[0] ?? '___');
}

function fragmentRegExp(fragment: string): RegExp {
  const escaped = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z'])${escaped}(?![A-Za-z'])`, 'g');
}

/** Number of whole-word occurrences of `fragment` in `text` ("a" is not found inside "Kate"). */
export function countFragment(text: string, fragment: string): number {
  return text.match(fragmentRegExp(fragment))?.length ?? 0;
}

/** Replaces the whole-word occurrence of `fragment` in `text`. */
export function replaceFragment(text: string, fragment: string, replacement: string): string {
  return text.replace(fragmentRegExp(fragment), replacement);
}

/** Removes `___` gap markers so the remaining words can be checked. */
function withoutGaps(text: string): string {
  return text.replace(/___/g, ' ');
}

export function exerciseStrings(ex: Exercise): ExerciseStrings {
  const en: string[] = [];
  const ru: string[] = [ex.hint, ex.explanation];
  const byScript = (...items: (string | undefined)[]) => {
    for (const s of items) if (s) (hasCyrillic(s) ? ru : en).push(s);
  };
  const lang = (from: 'en' | 'ru', source: string[], target: string[]) => {
    (from === 'en' ? en : ru).push(...source);
    (from === 'en' ? ru : en).push(...target);
  };

  switch (ex.type) {
    case 'translate_choice':
      lang(ex.from, [ex.text], ex.options);
      break;
    case 'picture_choice':
      break;
    case 'tiles':
      lang(ex.from, [ex.text], [ex.answer, ...ex.alternatives, ...ex.distractors]);
      break;
    case 'type_translation':
      lang(ex.from, [ex.text], ex.answers);
      break;
    case 'match_pairs':
      for (const p of ex.pairs) {
        en.push(p.en);
        ru.push(p.ru);
      }
      break;
    case 'fill_gap':
      en.push(fillGaps(ex.text, ex.answers), withoutGaps(ex.text), ...ex.answers.flat());
      if (ex.options) en.push(...ex.options);
      if (ex.cue) en.push(ex.cue);
      if (ex.translation) ru.push(ex.translation);
      break;
    case 'error_correction':
      en.push(ex.text, replaceFragment(ex.text, ex.wrong, ex.correction), ...ex.options);
      break;
    case 'listen_dictation':
      en.push(ex.text, ...ex.answers);
      break;
    case 'listen_choice':
      en.push(ex.audio);
      if (ex.question) ru.push(ex.question);
      byScript(...ex.options);
      break;
    case 'comprehension':
      for (const q of ex.questions) {
        ru.push(q.explanation);
        if (q.kind === 'mcq') byScript(q.question, ...q.options);
        else en.push(q.statement);
      }
      break;
    case 'speak_repeat':
      en.push(ex.text);
      break;
    case 'speak_answer':
      en.push(ex.question, ...ex.samples);
      ru.push(ex.questionRu);
      break;
    case 'speak_describe':
      en.push(...ex.samples);
      ru.push(ex.situation);
      break;
    case 'write':
      en.push(...ex.samples);
      ru.push(
        ex.task,
        ...ex.criteria.map((c) => c.label),
        ...ex.commonErrors.map((e) => e.message),
      );
      break;
    case 'minimal_pair':
      en.push(ex.pair[0].en, ex.pair[1].en);
      break;
    case 'word_stress':
      en.push(ex.word);
      break;
  }
  return { en, ru };
}
