/**
 * Content schema for the Jane course.
 *
 * Source files live in `content/` (JSON for units, Markdown for grammar notes) and are validated
 * against these schemas by `scripts/build-content.ts` before being compiled into the app bundle.
 * The same types are used at runtime, so a schema change is a contract change for both sides.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
export const Level = z.enum(LEVELS);
export type Level = z.infer<typeof Level>;

export const SKILLS = [
  'vocabulary',
  'grammar',
  'listening',
  'reading',
  'speaking',
  'writing',
  'pronunciation',
] as const;
export const Skill = z.enum(SKILLS);
export type Skill = z.infer<typeof Skill>;

/** Typical difficulties of Russian speakers; each one has a targeted exercise series. */
export const TROUBLES = [
  'articles',
  'word-order',
  'tenses',
  'prepositions',
  'false-friends',
  'pron-th',
  'pron-wv',
  'pron-r',
  'pron-vowels',
] as const;
export const Trouble = z.enum(TROUBLES);
export type Trouble = z.infer<typeof Trouble>;

export const PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adj',
  'adv',
  'pron',
  'det',
  'prep',
  'conj',
  'num',
  'interj',
  'modal',
  'phrasal',
  'phrase',
] as const;
export const PartOfSpeech = z.enum(PARTS_OF_SPEECH);
export type PartOfSpeech = z.infer<typeof PartOfSpeech>;

const text = z.string().trim().min(1);
/** Russian-language text shown to the learner (instructions, hints, explanations, translations). */
export const Ru = text;
/** English-language text. */
export const En = text;

const ID_RE = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
export const Id = z.string().regex(ID_RE, 'id: lowercase latin, digits, "." and "-"');

/** Word ids are the headword, lowercased, spaces → "-", optional "#pos" suffix to disambiguate. */
const WORD_ID_RE = /^[a-z0-9']+(?:-[a-z0-9']+)*(?:#[a-z]+)?$/;
export const WordId = z.string().regex(WORD_ID_RE, 'word id: "headword" or "head-word#pos"');

export const Bilingual = z.strictObject({ en: En, ru: Ru });
export type Bilingual = z.infer<typeof Bilingual>;

/** A picture for picture exercises: an emoji (rendered by the system font) or a bundled asset. */
export const Picture = z.union([z.strictObject({ emoji: text }), z.strictObject({ asset: Id })]);
export type Picture = z.infer<typeof Picture>;

// ---------------------------------------------------------------------------
// Lexicon
// ---------------------------------------------------------------------------

export const WordForms = z
  .strictObject({
    plural: En,
    third: En,
    past: En,
    pastParticiple: En,
    ing: En,
    comparative: En,
    superlative: En,
  })
  .partial();

export const Word = z.strictObject({
  id: WordId,
  en: En,
  /** American pronunciation, IPA without slashes, with ˈ ˌ stress marks and ː for long vowels. */
  ipa: text,
  pos: PartOfSpeech,
  /** Translations; the first one is the primary meaning used in exercises. */
  ru: z.array(Ru).min(1),
  example: Bilingual,
  forms: WordForms.optional(),
  /** Short note in Russian: usage, false friend warning, British variant, etc. */
  note: Ru.optional(),
  picture: Picture.optional(),
  topics: z.array(Id).default([]),
  troubles: z.array(Trouble).default([]),
});
export type Word = z.infer<typeof Word>;

// ---------------------------------------------------------------------------
// Texts: reading passages and dialogues
// ---------------------------------------------------------------------------

export const GENRES = [
  'conversation',
  'message',
  'profile',
  'email',
  'letter',
  'notice',
  'ad',
  'story',
  'article',
  'news',
  'interview',
  'review',
  'essay',
] as const;
export const Genre = z.enum(GENRES);

export const Speaker = z.strictObject({
  id: Id,
  name: text,
  voice: z.enum(['female', 'male']),
});

export const TextLine = z.strictObject({
  /** Speaker id for dialogues; omitted for reading passages. */
  speaker: Id.optional(),
  en: En,
  ru: Ru,
});

export const Text = z.strictObject({
  id: Id,
  kind: z.enum(['reading', 'dialogue']),
  genre: Genre,
  title: Bilingual,
  speakers: z.array(Speaker).default([]),
  lines: z.array(TextLine).min(1),
  /** Words above the learner's level that are allowed in this text, with a gloss. */
  glossary: z.array(Bilingual).default([]),
});
export type Text = z.infer<typeof Text>;

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

const Lang = z.enum(['en', 'ru']);

/** Fields every exercise has. `hint` is shown on request, `explanation` after the answer. */
const base = {
  id: Id,
  hint: Ru,
  explanation: Ru,
  /** 1 — recognition, 2 — guided production, 3 — free production. */
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  /** Words this exercise trains; feeds the spaced-repetition scheduler. */
  words: z.array(WordId).default([]),
  /** Grammar notes this exercise trains. */
  grammar: z.array(Id).default([]),
  troubles: z.array(Trouble).default([]),
};

const options = z.array(text).min(2).max(6);

/** Pick the translation of a word or phrase. */
export const TranslateChoice = z.strictObject({
  ...base,
  type: z.literal('translate_choice'),
  from: Lang,
  text,
  options,
  answer: z.number().int().min(0),
});

/** Match a word with its picture (or a picture with its word). */
export const PictureChoice = z.strictObject({
  ...base,
  type: z.literal('picture_choice'),
  mode: z.enum(['word-to-picture', 'picture-to-word']),
  /** The correct word; must have a `picture`. */
  word: WordId,
  /** Distractor words; must have pictures as well. */
  distractors: z.array(WordId).min(1).max(5),
});

/** Build a sentence from word tiles. */
export const Tiles = z.strictObject({
  ...base,
  type: z.literal('tiles'),
  from: Lang,
  text,
  /** The canonical target sentence; tiles are its tokens plus distractors. */
  answer: text,
  /** Other accepted orders/variants built from the same tiles. */
  alternatives: z.array(text).default([]),
  distractors: z.array(text).max(6).default([]),
});

/** Type a translation; checked with typo tolerance and alternative answers. */
export const TypeTranslation = z.strictObject({
  ...base,
  type: z.literal('type_translation'),
  from: Lang,
  text,
  answers: z.array(text).min(1),
});

/** Match pairs of English and Russian items. */
export const MatchPairs = z.strictObject({
  ...base,
  type: z.literal('match_pairs'),
  pairs: z.array(Bilingual).min(3).max(6),
});

/**
 * Fill in the gap(s) marked with `___`. With `options` the learner picks (one gap only),
 * otherwise types. `cue` is shown next to the gap, e.g. the base form of a verb: "(go)".
 */
export const FillGap = z.strictObject({
  ...base,
  type: z.literal('fill_gap'),
  text,
  translation: Ru.optional(),
  /** Accepted answers for each gap, in order. */
  answers: z.array(z.array(text).min(1)).min(1),
  options: options.optional(),
  cue: text.optional(),
});

/** Find the mistake in a sentence (tap the wrong fragment), then pick the correction. */
export const ErrorCorrection = z.strictObject({
  ...base,
  type: z.literal('error_correction'),
  text,
  /** The wrong fragment exactly as it appears in `text` (once). */
  wrong: text,
  correction: text,
  options: options,
});

/** Listen and type what you hear. */
export const ListenDictation = z.strictObject({
  ...base,
  type: z.literal('listen_dictation'),
  text,
  answers: z.array(text).default([]),
});

/** Listen and choose what you heard (or answer a question about it). */
export const ListenChoice = z.strictObject({
  ...base,
  type: z.literal('listen_choice'),
  audio: text,
  question: Ru.optional(),
  options,
  answer: z.number().int().min(0),
});

export const McqQuestion = z.strictObject({
  kind: z.literal('mcq'),
  question: text,
  options,
  answer: z.number().int().min(0),
  explanation: Ru,
});
export const TfnQuestion = z.strictObject({
  kind: z.literal('tfn'),
  statement: En,
  answer: z.enum(['true', 'false', 'not_given']),
  explanation: Ru,
});
export const ComprehensionQuestion = z.discriminatedUnion('kind', [McqQuestion, TfnQuestion]);

/** Questions to a reading passage or a dialogue (listening). */
export const Comprehension = z.strictObject({
  ...base,
  type: z.literal('comprehension'),
  mode: z.enum(['reading', 'listening']),
  textId: Id,
  questions: z.array(ComprehensionQuestion).min(1).max(8),
});

/** Listen and repeat a phrase; scored by speech recognition or by self-assessment. */
export const SpeakRepeat = z.strictObject({
  ...base,
  type: z.literal('speak_repeat'),
  text,
});

/** Groups of alternatives; a group counts when any of its patterns matches. */
const KeywordGroups = z.array(z.array(text).min(1)).min(1);

/** Answer a question out loud. */
export const SpeakAnswer = z.strictObject({
  ...base,
  type: z.literal('speak_answer'),
  question: En,
  questionRu: Ru,
  keywords: KeywordGroups,
  minKeywords: z.number().int().min(1),
  samples: z.array(En).min(1),
});

/** Describe a picture / situation out loud. */
export const SpeakDescribe = z.strictObject({
  ...base,
  type: z.literal('speak_describe'),
  picture: Picture,
  situation: Ru,
  keywords: KeywordGroups,
  minKeywords: z.number().int().min(1),
  samples: z.array(En).min(1),
});

/**
 * A writing criterion. `patterns` are case-insensitive regular expressions; the criterion is met
 * when any of them matches the learner's text.
 */
export const WritingCriterion = z.strictObject({
  id: Id,
  label: Ru,
  patterns: z.array(text).min(1),
  required: z.boolean().default(true),
});

export const CommonError = z.strictObject({
  pattern: text,
  message: Ru,
});

/** Short written answer checked by criteria, with typical-mistake detection. */
export const Write = z.strictObject({
  ...base,
  type: z.literal('write'),
  task: Ru,
  minWords: z.number().int().min(1),
  maxWords: z.number().int().min(1),
  criteria: z.array(WritingCriterion).min(1),
  commonErrors: z.array(CommonError).default([]),
  samples: z.array(En).min(1),
});

/** Hear one word of a minimal pair and choose which one it was. */
export const MinimalPair = z.strictObject({
  ...base,
  type: z.literal('minimal_pair'),
  pair: z.tuple([z.strictObject({ en: En, ipa: text }), z.strictObject({ en: En, ipa: text })]),
  say: z.union([z.literal(0), z.literal(1)]),
});

/** Choose the stressed syllable. */
export const WordStress = z.strictObject({
  ...base,
  type: z.literal('word_stress'),
  word: En,
  syllables: z.array(text).min(2),
  stress: z.number().int().min(0),
});

export const Exercise = z.discriminatedUnion('type', [
  TranslateChoice,
  PictureChoice,
  Tiles,
  TypeTranslation,
  MatchPairs,
  FillGap,
  ErrorCorrection,
  ListenDictation,
  ListenChoice,
  Comprehension,
  SpeakRepeat,
  SpeakAnswer,
  SpeakDescribe,
  Write,
  MinimalPair,
  WordStress,
]);
export type Exercise = z.infer<typeof Exercise>;
export type ExerciseType = Exercise['type'];
export type ExerciseOf<T extends ExerciseType> = Extract<Exercise, { type: T }>;

export const EXERCISE_TYPES = Exercise.options.map((o) => o.shape.type.value) as ExerciseType[];

// ---------------------------------------------------------------------------
// Lessons and units
// ---------------------------------------------------------------------------

export const LESSON_KINDS = [
  'vocabulary',
  'grammar',
  'listening',
  'reading',
  'speaking',
  'writing',
  'pronunciation',
  'review',
] as const;
export const LessonKind = z.enum(LESSON_KINDS);

export const Lesson = z.strictObject({
  id: Id,
  kind: LessonKind,
  title: Ru,
  /** Grammar note to show before the exercises. */
  grammar: Id.optional(),
  /** Text (reading passage or dialogue) the lesson is built around. */
  textId: Id.optional(),
  exercises: z.array(Exercise).min(1),
});
export type Lesson = z.infer<typeof Lesson>;

export const UnitTest = z.strictObject({
  passScore: z.number().min(0).max(1),
  exercises: z.array(Exercise).min(1),
});

export const Unit = z.strictObject({
  id: Id,
  level: Level,
  order: z.number().int().min(1),
  title: Bilingual,
  description: Ru,
  /** Can-do statements in Russian: "Могу …". */
  goals: z.array(Ru).min(1),
  grammar: z.array(Id).default([]),
  troubles: z.array(Trouble).default([]),
  words: z.array(Word).min(1),
  texts: z.array(Text).default([]),
  lessons: z.array(Lesson).min(1),
  test: UnitTest,
});
export type Unit = z.infer<typeof Unit>;
export type UnitInput = z.input<typeof Unit>;

export const LevelTest = z.strictObject({
  level: Level,
  passScore: z.number().min(0).max(1),
  exercises: z.array(Exercise).min(1),
});
export type LevelTest = z.infer<typeof LevelTest>;

export const Course = z.strictObject({
  /** Content version, bumped on every content release: YYYY.MM.patch. */
  version: z.string().regex(/^\d{4}\.\d{1,2}\.\d+$/),
  levels: z
    .array(
      z.strictObject({
        level: Level,
        title: Ru,
        description: Ru,
        units: z.array(Id).min(1),
      }),
    )
    .min(1),
});
export type Course = z.infer<typeof Course>;

// ---------------------------------------------------------------------------
// Grammar notes (authored in Markdown, compiled to blocks)
// ---------------------------------------------------------------------------

export const GrammarBlock = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('heading'), text }),
  z.strictObject({ type: z.literal('paragraph'), text }),
  z.strictObject({ type: z.literal('list'), items: z.array(text).min(1) }),
  z.strictObject({ type: z.literal('example'), en: En, ru: Ru }),
  z.strictObject({ type: z.literal('mistake'), wrong: En, right: En, why: Ru }),
  z.strictObject({ type: z.literal('tip'), text: Ru }),
  z.strictObject({
    type: z.literal('table'),
    header: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
  }),
]);
export type GrammarBlock = z.infer<typeof GrammarBlock>;

export const GrammarNote = z.strictObject({
  id: Id,
  level: Level,
  title: Ru,
  summary: Ru,
  /** Short English title used in the reference, e.g. "to be: present". */
  topic: En,
  troubles: z.array(Trouble).default([]),
  blocks: z.array(GrammarBlock).min(1),
});
export type GrammarNote = z.infer<typeof GrammarNote>;
