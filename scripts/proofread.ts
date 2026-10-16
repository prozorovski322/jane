/**
 * Proofreading aid: lists places in the content that look like slips (an explanation that does
 * not match the answer, a repeated word, unbalanced quotes, mixed alphabets in one word). It does
 * not change files and is not part of the strict check: some findings are fine on purpose.
 * Usage: npx tsx scripts/proofread.ts
 */
import { fillGaps, replaceFragment } from '../src/core/content/extract';
import { loadContent } from './lib/load';

const content = loadContent();
const out = new Map<string, string[]>();
const add = (kind: string, msg: string) => {
  if (!out.has(kind)) out.set(kind, []);
  out.get(kind)!.push(msg);
};

const norm = (s: string) =>
  s
    .replace(/[’‘]/g, "'")
    .replace(/[“”«»"]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?…]+$/, '')
    .trim()
    .toLowerCase();

const LATIN_IN_RU = /[а-яё][a-z]|[a-z][а-яё]/i;
const CYR = /[а-яё]/i;

function textChecks(where: string, s: string, lang: 'en' | 'ru' | 'any') {
  if (
    /\b(\w+) \1\b/i.test(s) &&
    !/\b(that that|had had|very very|bye bye|no no|so so|ha ha|knock knock)\b/i.test(s)
  )
    add('repeated word', `${where}: ${s}`);
  if (/ {2,}/.test(s)) add('double space', `${where}: ${s}`);
  if (/\s[,.!?:;]/.test(s) && !/\s…/.test(s)) add('space before punctuation', `${where}: ${s}`);
  const opens = (s.match(/«/g) ?? []).length;
  const closes = (s.match(/»/g) ?? []).length;
  if (opens !== closes) add('unbalanced «»', `${where}: ${s}`);
  if ((s.match(/\(/g) ?? []).length !== (s.match(/\)/g) ?? []).length)
    add('unbalanced ()', `${where}: ${s}`);
  if (LATIN_IN_RU.test(s.replace(/[A-Za-z]+(?=[\s.,!?)»:;-]|$)/g, (m) => m))) {
    // Mixed scripts inside one word, e.g. Latin "o" in a Russian word.
    for (const w of s.split(/[^A-Za-zА-Яа-яЁё]+/))
      if (/[A-Za-z]/.test(w) && /[А-Яа-яЁё]/.test(w))
        add('mixed-script word', `${where}: ${w} — ${s}`);
  }
  if (lang === 'en' && CYR.test(s)) add('Cyrillic in English', `${where}: ${s}`);
}

function sentenceChecks(where: string, s: string) {
  // Full English sentences: start with a capital, end with punctuation.
  if (s.split(' ').length < 4) return;
  if (/^[a-z]/.test(s) && !/^(e\.g\.|iPhone)/.test(s)) add('lowercase start', `${where}: ${s}`);
  if (!/[.!?…"»)]$/.test(s.trim())) add('no final punctuation', `${where}: ${s}`);
}

for (const unit of content.units) {
  for (const w of unit.words) {
    textChecks(`${w.id} example`, w.example?.en ?? '', 'en');
    if (w.example) {
      sentenceChecks(`${w.id} example`, w.example.en);
      textChecks(`${w.id} example ru`, w.example.ru, 'ru');
    }
  }
  for (const t of unit.texts)
    t.lines.forEach((l, i) => {
      textChecks(`${t.id}[${i}]`, l.en, 'en');
      textChecks(`${t.id}[${i}] ru`, l.ru, 'ru');
    });
  const all = [...unit.lessons.flatMap((l) => l.exercises), ...unit.test.exercises];
  for (const ex of all) {
    const id = ex.id;
    textChecks(`${id} hint`, ex.hint, 'any');
    textChecks(`${id} explanation`, ex.explanation, 'any');
    const said = /^(?:Правильно|Ответ): (.+)$/s.exec(ex.explanation)?.[1];
    switch (ex.type) {
      case 'fill_gap': {
        const full = fillGaps(ex.text, ex.answers);
        textChecks(`${id} text`, full, 'en');
        if (
          said &&
          !norm(said).startsWith(norm(full).slice(0, 12)) &&
          !norm(full).includes(norm(said).replace(/…$/, '').slice(0, 20)) &&
          !norm(said).includes(norm(full))
        )
          add('explanation ≠ answer', `${id}: "${full}" vs "${said}"`);
        if (ex.options && !ex.options.some((o) => ex.answers[0]!.includes(o)))
          add('options miss the answer', `${id}: ${ex.options.join(' | ')}`);
        if (ex.options && new Set(ex.options).size !== ex.options.length)
          add('duplicate options', `${id}: ${ex.options.join(' | ')}`);
        break;
      }
      case 'translate_choice': {
        const right = ex.options[ex.answer]!;
        if (
          said &&
          ex.from === 'ru' &&
          norm(said) !== norm(right) &&
          !norm(said).startsWith(norm(right))
        )
          add('explanation ≠ answer', `${id}: "${right}" vs "${said}"`);
        if (new Set(ex.options).size !== ex.options.length)
          add('duplicate options', `${id}: ${ex.options.join(' | ')}`);
        break;
      }
      case 'error_correction': {
        const fixed = replaceFragment(ex.text, ex.wrong, ex.correction);
        if (
          said &&
          norm(said) !== norm(fixed) &&
          !norm(said).startsWith(norm(fixed)) &&
          !norm(fixed).startsWith(norm(said))
        )
          add('explanation ≠ answer', `${id}: "${fixed}" vs "${said}"`);
        if (!ex.options.includes(ex.correction)) add('options miss the answer', `${id}`);
        break;
      }
      case 'tiles':
        sentenceChecks(`${id} answer`, ex.answer);
        if (said && norm(said) !== norm(ex.answer) && !norm(said).startsWith(norm(ex.answer)))
          add('explanation ≠ answer', `${id}: "${ex.answer}" vs "${said}"`);
        break;
      case 'type_translation':
        if (ex.from === 'ru' && said && !ex.answers.some((a) => norm(said).startsWith(norm(a))))
          add('explanation ≠ answer', `${id}: "${ex.answers[0]}" vs "${said}"`);
        break;
      case 'listen_choice':
        if (
          said &&
          !ex.options.some((o) => norm(o) === norm(said)) &&
          norm(ex.audio) !== norm(said)
        )
          add('explanation ≠ answer', `${id}: "${ex.audio}" vs "${said}"`);
        if (
          !ex.options.some((o) => norm(o) === norm(ex.audio)) &&
          ex.options.every((o) => !CYR.test(o))
        )
          add('audio not among options', `${id}: ${ex.audio}`);
        break;
      case 'speak_answer':
      case 'speak_describe':
        for (const s of ex.samples) sentenceChecks(`${id} sample`, s);
        break;
    }
  }
}

let total = 0;
for (const [kind, list] of out) {
  total += list.length;
  console.log(`\n== ${kind}: ${list.length}`);
  for (const m of list.slice(Number(process.env.FROM ?? 0), Number(process.env.FROM ?? 0) + 40))
    console.log('  ' + m);
}
console.log(`\n${total} finding(s)`);
