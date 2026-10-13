/**
 * One dictionary entry type for course words and the learner's own words, so search, word cards,
 * flashcards and reviews treat them alike.
 */
import type { LexiconEntry } from '@/core/content/bundle-types';
import type { Bilingual, Level, PartOfSpeech } from '@/core/content/schema';
import type { UserWord } from '@/core/storage/words-repo';

export interface DictEntry {
  id: string;
  en: string;
  ipa: string | null;
  pos: PartOfSpeech | null;
  ru: string[];
  example: Bilingual | null;
  note: string | null;
  level: Level | null;
  unit: string | null;
  own: boolean;
}

export function fromLexicon(e: LexiconEntry): DictEntry {
  return {
    id: e.id,
    en: e.en,
    ipa: e.ipa,
    pos: e.pos,
    ru: e.ru,
    example: e.example,
    note: e.note ?? null,
    level: e.level,
    unit: e.unit,
    own: false,
  };
}

export function fromUserWord(w: UserWord): DictEntry {
  return {
    id: w.id,
    en: w.en,
    ipa: null,
    pos: null,
    ru: w.ru,
    example: w.example,
    note: w.note,
    level: null,
    unit: null,
    own: true,
  };
}

/** Shape the review generator expects; own words get neutral defaults. */
export function asLexiconEntry(e: DictEntry): LexiconEntry {
  return {
    id: e.id,
    en: e.en,
    ipa: e.ipa ?? '',
    pos: e.pos ?? 'phrase',
    ru: e.ru,
    example: e.example ?? { en: e.en, ru: e.ru[0] ?? '' },
    note: e.note ?? undefined,
    topics: [],
    troubles: [],
    level: e.level ?? 'A1',
    unit: e.unit ?? 'user',
  };
}

export const POS_LABEL: Record<PartOfSpeech, string> = {
  noun: 'сущ.',
  verb: 'гл.',
  adj: 'прил.',
  adv: 'нареч.',
  pron: 'мест.',
  det: 'опред.',
  prep: 'предл.',
  conj: 'союз',
  num: 'числ.',
  interj: 'межд.',
  modal: 'модал.',
  phrasal: 'фраз. гл.',
  phrase: 'фраза',
};
