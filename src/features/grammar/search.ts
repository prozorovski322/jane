/** Search in the grammar reference: title, summary and every text of the note, Russian or English. */
import type { GrammarNote } from '@/core/content/schema';

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

/** Every string value of a note's blocks (examples, tables, tips), except structural tags. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) strings(v, out);
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) if (k !== 'type') strings(v, out);
  return out;
}

const cache = new WeakMap<GrammarNote, string>();

function haystack(note: GrammarNote): string {
  let h = cache.get(note);
  if (h === undefined) {
    h = normalize([note.title, note.topic, note.summary, ...strings(note.blocks)].join(' \n '));
    cache.set(note, h);
  }
  return h;
}

/** Notes that contain every word of the query (any order), best title matches first. */
export function searchGrammar(notes: readonly GrammarNote[], query: string): GrammarNote[] {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return [...notes];
  const matches = notes.filter((n) => words.every((w) => haystack(n).includes(w)));
  const inTitle = (n: GrammarNote) => words.every((w) => normalize(n.title).includes(w));
  return matches.sort((a, b) => Number(inTitle(b)) - Number(inTitle(a)));
}
