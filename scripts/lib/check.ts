/**
 * Semantic checks of the course content on top of the Zod schemas: identifiers, references,
 * exercise integrity, language of every string, vocabulary level, transcriptions, completeness.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { countKeywordGroups, compilePattern } from '../../src/core/checker/patterns';
import { checkWriting } from '../../src/core/checker/writing';
import { countFragment, exerciseStrings, hasCyrillic } from '../../src/core/content/extract';
import {
  expandContraction,
  headwordTokens,
  lemmaCandidates,
  tokenize,
  type Token,
} from '../../src/core/content/lexical';
import {
  LEVEL_BANDS,
  LEVELS,
  type Exercise,
  type Level,
  type Text,
  type Unit,
  type Word,
} from '../../src/core/content/schema';
import { normalizeAnswer } from '../../src/core/scoring/normalize';
import { splitTiles, tileMultisetKey } from '../../src/core/scoring/tiles';
import { compareWithCmu, ipaIssues } from './ipa';
import { PLACEMENT_FILE, type Issue, type LoadedContent } from './load';

/** Reading passage length (words) by level. */
const READING_WORDS: Record<Level, [number, number]> = {
  PA1: [8, 80],
  A1: [40, 160],
  A2: [80, 260],
  B1: [150, 420],
  B2: [250, 650],
  C1: [350, 900],
};
const LESSON_EXERCISES: [number, number] = [8, 20];
const TEST_EXERCISES_MIN = 12;
const MIXED_SCRIPT = /[A-Za-z][Ѐ-ӿ]|[Ѐ-ӿ][A-Za-z]/;

const IPA_EXCEPTIONS_FILE = join(__dirname, '..', 'data', 'ipa-exceptions.json');

type Report = (severity: Issue['severity'], path: string, message: string) => void;

function loadIpaExceptions(): Record<string, string> {
  if (!existsSync(IPA_EXCEPTIONS_FILE)) return {};
  return JSON.parse(readFileSync(IPA_EXCEPTIONS_FILE, 'utf8')) as Record<string, string>;
}

function dupes(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const i of items) {
    if (seen.has(i)) out.add(i);
    seen.add(i);
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

class Vocabulary {
  readonly allowed = new Set<string>();
  /** Capitalized words assumed to be names, with the first place they were seen. */
  readonly assumedNames = new Map<string, string>();

  constructor(private readonly content: LoadedContent) {}

  /** Replaces the known vocabulary, e.g. with the vocabulary of a level when a track starts. */
  reset(tokens: ReadonlySet<string>) {
    this.allowed.clear();
    for (const t of tokens) this.allowed.add(t);
  }

  addWord(w: Word) {
    for (const t of headwordTokens(w.en)) this.allowed.add(t);
    for (const form of Object.values(w.forms ?? {})) {
      for (const t of headwordTokens(form)) this.allowed.add(t);
    }
  }

  private known(part: string, extra: ReadonlySet<string>): boolean {
    const { alwaysAllowed, names, irregular } = this.content.extras;
    if (alwaysAllowed.has(part) || names.has(part)) return true;
    return lemmaCandidates(part, irregular).some((c) => this.allowed.has(c) || extra.has(c));
  }

  /** Tokens of `text` that are above the learner's vocabulary at this point. */
  unknownTokens(text: string, extra: ReadonlySet<string>, where: string): Token[] {
    const out: Token[] = [];
    for (const t of tokenize(text)) {
      if (/^[0-9]/.test(t.raw)) continue;
      const parts = expandContraction(t.lower);
      if (parts.every((p) => this.known(p, extra))) continue;
      const capitalized = /^[A-Z]/.test(t.raw) && t.raw !== 'I';
      if (capitalized && !t.sentenceStart) {
        if (!this.assumedNames.has(t.lower)) this.assumedNames.set(t.lower, where);
        continue;
      }
      out.push(t);
    }
    return out;
  }
}

function glossarySet(texts: readonly Text[]): Set<string> {
  const s = new Set<string>();
  for (const t of texts)
    for (const g of t.glossary) for (const tok of headwordTokens(g.en)) s.add(tok);
  return s;
}

// ---------------------------------------------------------------------------
// Exercise integrity
// ---------------------------------------------------------------------------

function checkOptions(report: Report, options: readonly string[], answer: number | undefined) {
  const d = dupes(options.map(normalizeAnswer));
  if (d.length) report('error', 'options', `duplicate options: ${d.join(', ')}`);
  if (answer !== undefined && answer >= options.length) {
    report('error', 'answer', `answer index ${answer} out of range (${options.length} options)`);
  }
}

function checkExercise(
  ex: Exercise,
  report: Report,
  /** `unit` is absent for exercises outside units (placement test). */
  ctx: { unit?: Unit; wordsById: ReadonlyMap<string, Word>; grammarIds: ReadonlySet<string> },
) {
  if (normalizeAnswer(ex.hint) === normalizeAnswer(ex.explanation)) {
    report('error', 'hint', 'hint and explanation are identical');
  }
  for (const w of ex.words) {
    if (!ctx.wordsById.has(w)) report('error', 'words', `unknown word id "${w}"`);
  }
  for (const g of ex.grammar) {
    if (!ctx.grammarIds.has(g)) report('error', 'grammar', `unknown grammar note "${g}"`);
  }

  const hintReveals = (answer: string) =>
    answer.length > 3 && normalizeAnswer(ex.hint).includes(normalizeAnswer(answer));

  switch (ex.type) {
    case 'translate_choice':
    case 'listen_choice': {
      checkOptions(report, ex.options, ex.answer);
      const correct = ex.options[ex.answer];
      if (correct && hintReveals(correct)) report('warning', 'hint', 'hint contains the answer');
      break;
    }
    case 'picture_choice': {
      const all = [ex.word, ...ex.distractors];
      if (dupes(all).length) report('error', 'distractors', 'the same word appears twice');
      for (const id of all) {
        const w = ctx.wordsById.get(id);
        if (!w) report('error', 'word', `unknown word id "${id}"`);
        else if (!w.picture) report('error', 'word', `word "${id}" has no picture`);
      }
      break;
    }
    case 'tiles': {
      const key = tileMultisetKey(splitTiles(ex.answer));
      ex.alternatives.forEach((alt, i) => {
        if (tileMultisetKey(splitTiles(alt)) !== key) {
          report(
            'error',
            `alternatives[${i}]`,
            'alternative must use exactly the same tiles as the answer',
          );
        }
      });
      const answerTiles = new Set(splitTiles(ex.answer).map(normalizeAnswer));
      for (const d of ex.distractors) {
        if (answerTiles.has(normalizeAnswer(d)))
          report('error', 'distractors', `"${d}" is also in the answer`);
      }
      if (splitTiles(ex.answer).length > 12)
        report('warning', 'answer', 'more than 12 tiles is hard on a phone');
      break;
    }
    case 'type_translation': {
      const d = dupes(ex.answers.map(normalizeAnswer));
      if (d.length) report('error', 'answers', `duplicate answers: ${d.join(', ')}`);
      if (hintReveals(ex.answers[0]!)) report('warning', 'hint', 'hint contains the answer');
      break;
    }
    case 'match_pairs': {
      if (dupes(ex.pairs.map((p) => normalizeAnswer(p.en))).length)
        report('error', 'pairs', 'duplicate English items');
      if (dupes(ex.pairs.map((p) => normalizeAnswer(p.ru))).length)
        report('error', 'pairs', 'duplicate Russian items');
      break;
    }
    case 'fill_gap': {
      const gaps = ex.text.split('___').length - 1;
      if (gaps === 0) report('error', 'text', 'no ___ gap in text');
      if (gaps !== ex.answers.length)
        report('error', 'answers', `${gaps} gaps but ${ex.answers.length} answer lists`);
      if (ex.options) {
        if (gaps !== 1) report('error', 'options', 'options are only allowed with a single gap');
        checkOptions(report, ex.options, undefined);
        const accepted = new Set((ex.answers[0] ?? []).map(normalizeAnswer));
        const correct = ex.options.filter((o) => accepted.has(normalizeAnswer(o)));
        if (correct.length !== 1)
          report('error', 'options', `exactly one option must be correct, found ${correct.length}`);
      }
      if (hintReveals(ex.answers[0]?.[0] ?? ''))
        report('warning', 'hint', 'hint contains the answer');
      break;
    }
    case 'error_correction': {
      const occurrences = countFragment(ex.text, ex.wrong);
      if (occurrences !== 1)
        report(
          'error',
          'wrong',
          `"${ex.wrong}" must occur exactly once in text (found ${occurrences})`,
        );
      checkOptions(report, ex.options, undefined);
      if (!ex.options.includes(ex.correction))
        report('error', 'options', 'options must include the correction');
      if (normalizeAnswer(ex.wrong) === normalizeAnswer(ex.correction))
        report('error', 'correction', 'correction equals the wrong fragment');
      break;
    }
    case 'comprehension': {
      const text = ctx.unit?.texts.find((t) => t.id === ex.textId);
      if (!text) report('error', 'textId', `unknown text "${ex.textId}"`);
      ex.questions.forEach((q, i) => {
        if (q.kind === 'mcq') {
          checkOptions((s, p, m) => report(s, `questions[${i}].${p}`, m), q.options, q.answer);
        }
      });
      break;
    }
    case 'speak_answer':
    case 'speak_describe': {
      if (ex.minKeywords > ex.keywords.length)
        report('error', 'minKeywords', 'minKeywords exceeds the number of groups');
      for (const [gi, group] of ex.keywords.entries()) {
        for (const p of group) {
          try {
            compilePattern(p);
          } catch {
            report('error', `keywords[${gi}]`, `invalid pattern ${p}`);
          }
        }
      }
      ex.samples.forEach((s, i) => {
        const n = countKeywordGroups(s, ex.keywords);
        if (n < ex.minKeywords)
          report(
            'error',
            `samples[${i}]`,
            `sample matches ${n} keyword groups, needs ${ex.minKeywords}`,
          );
      });
      break;
    }
    case 'write': {
      if (ex.minWords > ex.maxWords) report('error', 'minWords', 'minWords > maxWords');
      let patternsOk = true;
      for (const p of [
        ...ex.criteria.flatMap((c) => c.patterns),
        ...ex.commonErrors.map((e) => e.pattern),
      ]) {
        try {
          compilePattern(p);
        } catch {
          patternsOk = false;
          report('error', 'criteria', `invalid pattern ${p}`);
        }
      }
      if (!patternsOk) break;
      ex.samples.forEach((s, i) => {
        const r = checkWriting(s, ex);
        if (!r.passed) {
          const why = [
            r.tooShort && `too short (${r.wordCount})`,
            r.tooLong && `too long (${r.wordCount})`,
            ...r.criteria.filter((c) => c.required && !c.met).map((c) => `misses "${c.id}"`),
            ...r.mistakes.map((m) => `flags "${m.fragment}"`),
          ].filter(Boolean);
          report('error', `samples[${i}]`, `sample answer fails the checker: ${why.join('; ')}`);
        }
      });
      break;
    }
    case 'minimal_pair': {
      if (normalizeAnswer(ex.pair[0].en) === normalizeAnswer(ex.pair[1].en))
        report('error', 'pair', 'both words are the same');
      for (const [i, w] of ex.pair.entries()) {
        for (const m of ipaIssues(w.ipa)) report('error', `pair[${i}].ipa`, m);
      }
      break;
    }
    case 'word_stress': {
      if (ex.stress >= ex.syllables.length) report('error', 'stress', 'stress index out of range');
      const joined = ex.syllables.join('').toLowerCase();
      if (joined !== ex.word.toLowerCase().replace(/[\s-]/g, ''))
        report('error', 'syllables', `syllables spell "${joined}"`);
      break;
    }
    case 'listen_dictation':
    case 'speak_repeat':
      break;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function checkContent(content: LoadedContent): Issue[] {
  const issues: Issue[] = [...content.issues];
  const ipaExceptions = loadIpaExceptions();
  const vocab = new Vocabulary(content);
  const wordsById = new Map<string, Word>();
  const wordKeys = new Map<string, string>();
  /** Who introduced each word: a level ("B2") or a track ("track:travel"). */
  const wordOwner = new Map<string, string>();
  /** Known vocabulary at the end of each level, the starting point of the tracks that require it. */
  const levelSnapshots = new Map<Level, Set<string>>();
  let currentTrack: string | null = null;
  const allIds = new Map<string, string>();
  const grammarIds = new Set(content.grammar.keys());
  const grammarSeen = new Set<string>();

  const claimId = (id: string, file: string, path: string) => {
    const prev = allIds.get(id);
    if (prev)
      issues.push({
        severity: 'error',
        file,
        path,
        message: `duplicate id "${id}" (also in ${prev})`,
      });
    else allIds.set(id, `${file}:${path}`);
  };

  if (content.course) {
    const courseIssue = (path: string, message: string) =>
      issues.push({ severity: 'error', file: 'content/course.json', path, message });
    const unitIdOk = (level: string, id: string) => new RegExp(`^${level}\\.u\\d{2}$`).test(id);

    for (const d of dupes(content.course.levels.map((l) => l.level)))
      courseIssue('levels', `level ${d} listed twice`);

    // Levels must follow the CEFR order so the path and the unlocking logic can rely on it.
    const order = content.course.levels.map((l) => LEVELS.indexOf(l.level));
    if (order.some((o, i) => i > 0 && o < order[i - 1]!))
      courseIssue('levels', 'levels must be listed in CEFR order (PA1, A1, A2, B1, B2, C1)');

    const everyUnit: string[] = [];
    for (const [li, level] of content.course.levels.entries()) {
      const code = level.level.toLowerCase();
      for (const [mi, m] of level.modules.entries()) {
        const at = `levels[${li}].modules[${mi}]`;
        if (m.id !== `${code}.m${m.order}`)
          courseIssue(`${at}.id`, `module id must be "${code}.m${m.order}"`);
        if (m.order !== mi + 1) courseIssue(`${at}.order`, `modules must be numbered 1, 2, 3…`);
        if (m.units.length + m.planned.length === 0)
          courseIssue(`${at}.units`, `module ${m.id} has no units`);
        for (const id of m.units) {
          everyUnit.push(id);
          if (!unitIdOk(code, id)) courseIssue(`${at}.units`, `"${id}" is not a ${code} unit id`);
          if (!content.files.has(id))
            courseIssue(`${at}.units`, `unit "${id}" is listed but has no file`);
        }
        for (const p of m.planned) {
          everyUnit.push(p.id);
          if (!unitIdOk(code, p.id))
            courseIssue(`${at}.planned`, `"${p.id}" is not a ${code} unit id`);
          if (content.files.has(p.id))
            courseIssue(
              `${at}.planned`,
              `unit "${p.id}" is written: move it from "planned" to "units"`,
            );
        }
      }
    }
    // Tracks: optional branches with their own unit ids ("travel.u01").
    const levelCodes = new Set(LEVELS.map((l) => l.toLowerCase()));
    for (const d of dupes(content.course.tracks.map((t) => t.id)))
      courseIssue('tracks', `track ${d} listed twice`);
    for (const [ti, track] of content.course.tracks.entries()) {
      const at = `tracks[${ti}]`;
      if (levelCodes.has(track.id) || !/^[a-z]+$/.test(track.id))
        courseIssue(`${at}.id`, `track id must be lowercase letters and not a level code`);
      if (track.units.length + track.planned.length === 0)
        courseIssue(`${at}.units`, `track ${track.id} has no units`);
      for (const id of track.units) {
        everyUnit.push(id);
        if (!unitIdOk(track.id, id))
          courseIssue(`${at}.units`, `"${id}" is not a ${track.id} unit id`);
        if (!content.files.has(id))
          courseIssue(`${at}.units`, `unit "${id}" is listed but has no file`);
      }
      for (const p of track.planned) {
        everyUnit.push(p.id);
        if (!unitIdOk(track.id, p.id))
          courseIssue(`${at}.planned`, `"${p.id}" is not a ${track.id} unit id`);
        if (content.files.has(p.id))
          courseIssue(
            `${at}.planned`,
            `unit "${p.id}" is written: move it from "planned" to "units"`,
          );
      }
      const nums = [...track.units, ...track.planned.map((p) => p.id)].map((id) =>
        Number(id.split('.u')[1]),
      );
      if (nums.some((n, i) => n !== i + 1))
        courseIssue(at, `${track.id} units must be numbered u01, u02, … in order`);
    }
    for (const d of dupes(everyUnit)) courseIssue('levels', `unit ${d} appears twice`);

    // Unit numbers within a level run 1…n in course order, written and planned alike.
    for (const level of content.course.levels) {
      const nums = level.modules
        .flatMap((m) => [...m.units, ...m.planned.map((p) => p.id)])
        .map((id) => Number(id.split('.u')[1]));
      if (nums.some((n, i) => n !== i + 1))
        courseIssue('levels', `${level.level} units must be numbered u01, u02, … in order`);
    }
  }

  for (const unit of content.units) {
    const file = content.files.get(unit.id) ?? '';
    const at =
      (prefix: string): Report =>
      (severity, path, message) =>
        issues.push({ severity, file, path: path ? `${prefix}.${path}` : prefix, message });
    const unitReport = at('unit');

    // Identity. Track units are numbered within their track and need its level to be written.
    const track = unit.track ? content.course?.tracks.find((t) => t.id === unit.track) : undefined;
    if (unit.track && !track) unitReport('error', 'track', `unknown track "${unit.track}"`);
    if (track && LEVELS.indexOf(unit.level) < LEVELS.indexOf(track.requires))
      unitReport('error', 'level', `unit is ${unit.level}, the track requires ${track.requires}`);
    const code = unit.track ?? unit.level.toLowerCase();
    const expectedId = `${code}.u${String(unit.order).padStart(2, '0')}`;
    if (unit.id !== expectedId)
      unitReport(
        'error',
        'id',
        `expected id "${expectedId}" from ${unit.track ? 'track' : 'level'} and order`,
      );
    claimId(unit.id, file, 'id');

    // A track starts from the vocabulary of the level it requires, not from the whole course.
    if (track && currentTrack !== track.id) {
      currentTrack = track.id;
      const base = levelSnapshots.get(track.requires);
      if (!base) unitReport('error', 'track', `level ${track.requires} has no written units yet`);
      vocab.reset(base ?? new Set());
    }
    const owner = track ? `track:${track.id}` : unit.level;
    // Words a learner of this unit already knows: everything for a level unit; for a track unit,
    // words of the required level and below, and of earlier units of the same track.
    const visible = (o: string): boolean =>
      !track ||
      o === owner ||
      ((LEVELS as readonly string[]).includes(o) &&
        LEVELS.indexOf(o as Level) <= LEVELS.indexOf(track.requires));

    // Vocabulary of this unit becomes available to all of its content.
    unit.words.forEach((w, i) => {
      const report = at(`words[${i}]`);
      const prevWord = wordsById.get(w.id);
      if (prevWord) {
        // A track may teach a word that the course introduces only at a higher level: it then
        // reuses that word's id, so the dictionary and the review schedule keep one entry.
        const shared =
          !visible(wordOwner.get(w.id) ?? '') && prevWord.en === w.en && prevWord.pos === w.pos;
        if (!shared) report('error', 'id', `duplicate word id "${w.id}"`);
      } else {
        wordsById.set(w.id, w);
        wordOwner.set(w.id, owner);
      }
      const key = `${w.en.toLowerCase()}#${w.pos}`;
      const prev = wordKeys.get(key);
      if (prev && visible(wordOwner.get(prev) ?? ''))
        report('error', 'en', `"${w.en}" (${w.pos}) already introduced as "${prev}"`);
      else if (prev && prev !== w.id)
        report(
          'error',
          'id',
          `"${w.en}" (${w.pos}) is "${prev}" elsewhere in the course: reuse that id`,
        );
      if (!prev) wordKeys.set(key, w.id);
      vocab.addWord(w);

      if (hasCyrillic(w.en) || hasCyrillic(w.example.en))
        report('error', 'en', 'Cyrillic letters in English text');
      for (const ru of [...w.ru, w.example.ru, w.note ?? 'ок']) {
        if (!hasCyrillic(ru)) report('error', 'ru', `"${ru}" has no Cyrillic letters`);
        if (MIXED_SCRIPT.test(ru)) report('error', 'ru', `mixed Latin/Cyrillic letters in "${ru}"`);
      }
      if (dupes(w.ru).length) report('error', 'ru', 'duplicate translations');

      for (const m of ipaIssues(w.ipa)) report('error', 'ipa', m);
      if (!ipaExceptions[w.id]) {
        const words = w.en.replace(/[?!.,]/g, '').split(/\s+/);
        const ipas = w.ipa.split(/\s+/);
        if (words.length === ipas.length) {
          words.forEach((word, wi) => {
            const cmp = compareWithCmu(word, ipas[wi]!);
            if (!cmp.consonantsMatch)
              report(
                'error',
                'ipa',
                `"${word}" /${ipas[wi]}/ — consonants differ from CMUdict: ${cmp.expected}`,
              );
            else if (!cmp.stressMatch)
              report(
                'error',
                'ipa',
                `"${word}" /${ipas[wi]}/ — stress differs from CMUdict: ${cmp.expected}`,
              );
          });
        } else {
          report('error', 'ipa', `${words.length} words but ${ipas.length} transcribed words`);
        }
      }

      const head = new Set(headwordTokens(w.en));
      const exampleHasWord = tokenize(w.example.en).some((t) =>
        expandContraction(t.lower).some((p) =>
          lemmaCandidates(p, content.extras.irregular).some((c) => head.has(c)),
        ),
      );
      if (!exampleHasWord) report('warning', 'example', `example does not contain "${w.en}"`);
    });

    // Word examples may use any word of the unit, so they are checked once all words are added.
    unit.words.forEach((w, i) => {
      for (const t of vocab.unknownTokens(w.example.en, new Set(), `${file} words[${i}]`)) {
        at(`words[${i}]`)('error', 'example', `"${t.raw}" is above the level`);
      }
    });

    // Grammar notes referenced by this unit.
    unit.grammar.forEach((g, i) => {
      const note = content.grammar.get(g);
      if (!note) {
        unitReport('error', `grammar[${i}]`, `unknown grammar note "${g}"`);
        return;
      }
      if (note.level !== unit.level)
        unitReport(
          'warning',
          `grammar[${i}]`,
          `note "${g}" is ${note.level}, unit is ${unit.level}`,
        );
      if (grammarSeen.has(g)) return;
      grammarSeen.add(g);
      const noteFile = content.files.get(g) ?? '';
      note.blocks.forEach((b, bi) => {
        const en = b.type === 'example' ? [b.en] : b.type === 'mistake' ? [b.right] : [];
        for (const s of en) {
          for (const t of vocab.unknownTokens(s, new Set(), `${noteFile}`)) {
            issues.push({
              severity: 'error',
              file: noteFile,
              path: `blocks[${bi}]`,
              message: `"${t.raw}" is above the level of ${unit.id}`,
            });
          }
        }
        if (b.type === 'example' && hasCyrillic(b.en)) {
          issues.push({
            severity: 'error',
            file: noteFile,
            path: `blocks[${bi}]`,
            message: 'Cyrillic in English example',
          });
        }
      });
    });

    // Texts.
    const textIds = new Set<string>();
    const usedTexts = new Set<string>();
    unit.texts.forEach((t, i) => {
      const report = at(`texts[${i}]`);
      claimId(t.id, file, `texts[${i}].id`);
      textIds.add(t.id);
      if (!t.id.startsWith(`${unit.id}.`))
        report('error', 'id', `text id must start with "${unit.id}."`);
      const speakers = new Set(t.speakers.map((s) => s.id));
      t.lines.forEach((l, li) => {
        if (t.kind === 'dialogue' && (!l.speaker || !speakers.has(l.speaker)))
          report('error', `lines[${li}].speaker`, 'dialogue line needs a known speaker');
        if (t.kind === 'reading' && l.speaker)
          report('error', `lines[${li}].speaker`, 'reading passage lines have no speaker');
        if (hasCyrillic(l.en))
          report('error', `lines[${li}].en`, 'Cyrillic letters in English text');
        if (!hasCyrillic(l.ru))
          report('error', `lines[${li}].ru`, 'translation has no Cyrillic letters');
      });
      if (t.kind === 'dialogue' && t.speakers.length < 2)
        report('error', 'speakers', 'a dialogue needs at least two speakers');
      if (t.kind === 'dialogue' && (t.lines.length < 4 || t.lines.length > 24))
        report('warning', 'lines', `dialogue has ${t.lines.length} lines (4–24 expected)`);
      if (t.kind === 'reading') {
        const words = t.lines.reduce((n, l) => n + tokenize(l.en).length, 0);
        const [min, max] = READING_WORDS[unit.level];
        if (words < min || words > max)
          report(
            'warning',
            'lines',
            `reading has ${words} words (${min}–${max} expected for ${unit.level})`,
          );
      }
      const gloss = glossarySet([t]);
      for (const [li, l] of t.lines.entries()) {
        for (const tok of vocab.unknownTokens(l.en, gloss, `${file} texts[${i}]`)) {
          report(
            'error',
            `lines[${li}]`,
            `"${tok.raw}" is above the level (add it to the unit words or to the glossary)`,
          );
        }
      }
    });

    // Lessons and test.
    const typesInUnit = new Set<string>();
    const comprehensionModes = new Set<string>();
    const exerciseGroups: {
      prefix: string;
      idPrefix: string;
      textId?: string;
      exercises: Exercise[];
    }[] = [];
    unit.lessons.forEach((lesson, li) => {
      const report = at(`lessons[${li}]`);
      const expected = `${unit.id}.l${String(li + 1).padStart(2, '0')}`;
      if (lesson.id !== expected) report('error', 'id', `expected lesson id "${expected}"`);
      claimId(lesson.id, file, `lessons[${li}].id`);
      if (lesson.grammar && !unit.grammar.includes(lesson.grammar))
        report('error', 'grammar', `"${lesson.grammar}" is not in unit.grammar`);
      if (lesson.textId) {
        if (!textIds.has(lesson.textId))
          report('error', 'textId', `unknown text "${lesson.textId}"`);
        usedTexts.add(lesson.textId);
      }
      const [min, max] = LESSON_EXERCISES;
      if (lesson.exercises.length < min || lesson.exercises.length > max) {
        report(
          'warning',
          'exercises',
          `${lesson.exercises.length} exercises (${min}–${max} expected)`,
        );
      }
      exerciseGroups.push({
        prefix: `lessons[${li}]`,
        idPrefix: `${lesson.id}.`,
        textId: lesson.textId,
        exercises: lesson.exercises,
      });
    });
    if (unit.test.exercises.length < TEST_EXERCISES_MIN) {
      unitReport(
        'error',
        'test.exercises',
        `unit test needs at least ${TEST_EXERCISES_MIN} exercises`,
      );
    }
    exerciseGroups.push({
      prefix: 'test',
      idPrefix: `${unit.id}.test.`,
      exercises: unit.test.exercises,
    });

    const practiced = new Set<string>();
    for (const group of exerciseGroups) {
      group.exercises.forEach((ex, ei) => {
        const path = `${group.prefix}.exercises[${ei}]`;
        const report = at(path);
        claimId(ex.id, file, `${path}.id`);
        if (!ex.id.startsWith(group.idPrefix))
          report('error', 'id', `exercise id must start with "${group.idPrefix}"`);
        typesInUnit.add(ex.type);
        if (ex.type === 'comprehension') {
          comprehensionModes.add(ex.mode);
          usedTexts.add(ex.textId);
        }

        checkExercise(ex, report, { unit, wordsById, grammarIds });

        const strings = exerciseStrings(ex);
        for (const s of strings.en) {
          if (hasCyrillic(s)) report('error', '', `Cyrillic letters in English text "${s}"`);
        }
        for (const s of strings.ru) {
          if (!hasCyrillic(s)) report('error', '', `Russian text has no Cyrillic letters: "${s}"`);
          if (MIXED_SCRIPT.test(s)) report('error', '', `mixed Latin/Cyrillic letters in "${s}"`);
        }

        const textForGloss = unit.texts.filter(
          (t) => t.id === group.textId || (ex.type === 'comprehension' && t.id === ex.textId),
        );
        const gloss = glossarySet(textForGloss);
        const unknown = new Set<string>();
        // Minimal pairs are sound drills: their words are heard, not learned.
        const levelChecked = ex.type === 'minimal_pair' ? [] : strings.en;
        for (const s of levelChecked) {
          for (const tok of vocab.unknownTokens(s, gloss, `${file} ${path}`)) unknown.add(tok.raw);
        }
        if (unknown.size) report('error', '', `above the level: ${[...unknown].join(', ')}`);

        for (const w of ex.words) practiced.add(w);
        const tokens = new Set(
          strings.en
            .flatMap((s) => tokenize(s).flatMap((t) => expandContraction(t.lower)))
            .flatMap((p) => lemmaCandidates(p, content.extras.irregular)),
        );
        for (const w of unit.words) {
          if (headwordTokens(w.en).every((t) => tokens.has(t))) practiced.add(w.id);
        }
        if (ex.type === 'picture_choice')
          [ex.word, ...ex.distractors].forEach((w) => practiced.add(w));
      });
    }

    unit.words.forEach((w, i) => {
      if (!practiced.has(w.id))
        at(`words[${i}]`)('warning', '', `"${w.en}" is not used in any exercise`);
    });
    unit.texts.forEach((t, i) => {
      if (!usedTexts.has(t.id))
        at(`texts[${i}]`)('warning', '', `text "${t.id}" is not used by any lesson`);
    });

    // Completeness: every unit trains all four skills.
    const requireType = (types: string[], what: string) => {
      if (!types.some((t) => typesInUnit.has(t))) unitReport('error', '', `unit has no ${what}`);
    };
    if (!comprehensionModes.has('reading'))
      unitReport('error', '', 'unit has no reading comprehension');
    if (!comprehensionModes.has('listening'))
      unitReport('error', '', 'unit has no listening comprehension');
    requireType(['speak_repeat', 'speak_answer', 'speak_describe'], 'speaking exercise');
    requireType(['write'], 'writing exercise');
    requireType(['minimal_pair', 'word_stress'], 'pronunciation exercise');
    requireType(['listen_dictation', 'listen_choice'], 'listen-and-type/choose exercise');
    if (unit.goals.length < 3) unitReport('warning', 'goals', 'fewer than 3 can-do goals');
    unit.goals.forEach((g, i) => {
      if (!/^Могу /.test(g))
        unitReport('warning', `goals[${i}]`, 'can-do goals start with "Могу …"');
    });

    if (!unit.track) levelSnapshots.set(unit.level, new Set(vocab.allowed));
  }

  for (const [name, where] of vocab.assumedNames) {
    issues.push({
      severity: 'warning',
      file: where.split(' ')[0] ?? '',
      path: where.split(' ').slice(1).join(' '),
      message: `"${name}" is treated as a proper name; add it to content/lexicon/names.json or to the words`,
    });
  }
  for (const id of grammarIds) {
    if (!grammarSeen.has(id)) {
      issues.push({
        severity: 'warning',
        file: content.files.get(id) ?? '',
        path: '',
        message: `grammar note "${id}" is not used by any unit`,
      });
    }
  }

  checkPlacement(content, issues, { wordsById, grammarIds, claimId });
  return issues;
}

/**
 * Placement bank: the same exercise integrity and language checks as lessons. Vocabulary level
 * is not checked here: the bank covers A1–B2 while the course lexicon grows unit by unit.
 */
function checkPlacement(
  content: LoadedContent,
  issues: Issue[],
  ctx: {
    wordsById: ReadonlyMap<string, Word>;
    grammarIds: ReadonlySet<string>;
    claimId: (id: string, file: string, path: string) => void;
  },
) {
  const bank = content.placement;
  if (!bank) {
    issues.push({
      severity: 'error',
      file: PLACEMENT_FILE,
      path: '',
      message: 'placement bank is missing',
    });
    return;
  }
  const perLevel = new Map<Level, number>();
  bank.items.forEach((item, i) => {
    const ex = item.exercise;
    const path = `items[${i}]`;
    const report: Report = (severity, p, message) =>
      issues.push({ severity, file: PLACEMENT_FILE, path: p ? `${path}.${p}` : path, message });

    ctx.claimId(ex.id, PLACEMENT_FILE, `${path}.exercise.id`);
    const prefix = `placement.${item.level.toLowerCase()}.`;
    if (!ex.id.startsWith(prefix)) report('error', 'exercise.id', `id must start with "${prefix}"`);
    const [lo, hi] = LEVEL_BANDS[item.level];
    if (item.b < lo - 0.05 || item.b > hi + 0.05)
      report('error', 'b', `b=${item.b} is outside the ${item.level} band ${lo}…${hi}`);
    if (ex.type === 'fill_gap' && !ex.options)
      report('error', 'exercise.options', 'placement items must be multiple choice');
    perLevel.set(item.level, (perLevel.get(item.level) ?? 0) + 1);

    checkExercise(ex, (s, p, m) => report(s, `exercise.${p}`.replace(/\.$/, ''), m), ctx);
    const strings = exerciseStrings(ex);
    for (const s of strings.en)
      if (hasCyrillic(s)) report('error', 'exercise', `Cyrillic letters in English text "${s}"`);
    for (const s of strings.ru) {
      if (!hasCyrillic(s))
        report('error', 'exercise', `Russian text has no Cyrillic letters: "${s}"`);
      if (MIXED_SCRIPT.test(s))
        report('error', 'exercise', `mixed Latin/Cyrillic letters in "${s}"`);
    }
  });
  for (const level of LEVELS) {
    const n = perLevel.get(level) ?? 0;
    if (n < 10) {
      issues.push({
        severity: 'error',
        file: PLACEMENT_FILE,
        path: 'items',
        message: `only ${n} items for ${level}; at least 10 needed`,
      });
    }
  }
}
