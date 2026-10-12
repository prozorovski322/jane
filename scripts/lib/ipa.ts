/**
 * IPA helpers for the content checker: format validation and cross-checking against CMUdict
 * (American English, BSD license, see CREDITS.md). Only used at build time.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Symbols allowed in our American IPA transcriptions. */
const IPA_ALLOWED = /^[ˈˌːəɚɝɪʊɛæɑɔʌθðʃʒŋɡjwrlmnpbtdkfvszhiueoaɾʔ .‿-]+$/u;

const VOWEL_NUCLEUS = /(aɪ|aʊ|eɪ|oʊ|ɔɪ|ɝː|iː|uː|ɑː|ɔː|[əɚɪʊɛæɑɔʌieuoa])/gu;

export function ipaIssues(ipa: string): string[] {
  const issues: string[] = [];
  if (/^\/|\/$/.test(ipa)) issues.push('no slashes: they are added by the UI');
  if (!IPA_ALLOWED.test(ipa)) {
    const bad = [...ipa].filter((c) => !IPA_ALLOWED.test(c));
    issues.push(`unexpected symbols: ${[...new Set(bad)].join(' ')}`);
  }
  if (/g/.test(ipa)) issues.push('use IPA ɡ (U+0261), not latin g');
  for (const word of ipa.split(/[ ‿-]+/)) {
    const nuclei = word.match(VOWEL_NUCLEUS)?.length ?? 0;
    if (nuclei >= 2 && !word.includes('ˈ')) issues.push(`"${word}": multi-syllable word without ˈ`);
  }
  return issues;
}

const ARPABET: Record<string, string> = {
  AA: 'ɑː',
  AE: 'æ',
  AH: 'ʌ',
  AO: 'ɔː',
  AW: 'aʊ',
  AY: 'aɪ',
  EH: 'e',
  ER: 'ɝː',
  EY: 'eɪ',
  IH: 'ɪ',
  IY: 'iː',
  OW: 'oʊ',
  OY: 'ɔɪ',
  UH: 'ʊ',
  UW: 'uː',
  B: 'b',
  CH: 'tʃ',
  D: 'd',
  DH: 'ð',
  F: 'f',
  G: 'ɡ',
  HH: 'h',
  JH: 'dʒ',
  K: 'k',
  L: 'l',
  M: 'm',
  N: 'n',
  NG: 'ŋ',
  P: 'p',
  R: 'r',
  S: 's',
  SH: 'ʃ',
  T: 't',
  TH: 'θ',
  V: 'v',
  W: 'w',
  Y: 'j',
  Z: 'z',
  ZH: 'ʒ',
};

/** CMUdict entry as a list of phones with stress digits, e.g. ["HH","AH0","L","OW1"]. */
export type CmuEntry = string[];

let cmu: Map<string, CmuEntry[]> | null = null;

export function loadCmudict(
  path = join(__dirname, '..', 'data', 'cmudict.dict'),
): Map<string, CmuEntry[]> {
  if (cmu) return cmu;
  cmu = new Map();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^([^\s(]+)(?:\(\d+\))?\s+([^#]+)/.exec(line);
    if (!m) continue;
    const list = cmu.get(m[1]!) ?? [];
    list.push(m[2]!.trim().split(/\s+/));
    cmu.set(m[1]!, list);
  }
  return cmu;
}

/** Consonants only: the most reliable thing to compare between transcription styles. */
function consonantSkeleton(ipa: string): string {
  return ipa
    .replace(/tʃ/g, 'C')
    .replace(/dʒ/g, 'J')
    .replace(/[ˈˌː.‿ -]/g, '')
    .replace(/[əɚɝɪʊɛæɑɔʌieuoaɒ]/g, '')
    .replace(/ɾ/g, 't');
}

function arpabetToSkeleton(entry: CmuEntry): string {
  return consonantSkeleton(
    entry
      .map((p) => {
        const phone = p.replace(/\d$/, '');
        // Unstressed ER is the r-colored schwa; treat it as a vowel only.
        return ARPABET[phone] ?? '';
      })
      .join(''),
  );
}

/**
 * Indexes of syllables with primary stress (0-based). Some CMUdict entries mark two primary
 * stresses (e.g. "engineer" EH1 … IH1); any of them is accepted.
 */
function cmuStressIndexes(entry: CmuEntry): number[] {
  const out: number[] = [];
  let syllable = -1;
  for (const p of entry) {
    if (/\d$/.test(p)) {
      syllable++;
      if (p.endsWith('1')) out.push(syllable);
    }
  }
  return out;
}

function ipaStressIndex(word: string): number {
  const at = word.indexOf('ˈ');
  if (at < 0) return -1;
  return word.slice(0, at).match(VOWEL_NUCLEUS)?.length ?? 0;
}

export interface IpaComparison {
  /** Word not found in CMUdict: nothing to compare. */
  unknown: boolean;
  consonantsMatch: boolean;
  stressMatch: boolean;
  expected: string;
}

/**
 * Compares one word's transcription with CMUdict. Any matching pronunciation variant counts.
 * Vowels are not compared: vowel quality varies too much between transcription conventions.
 */
export function compareWithCmu(word: string, ipa: string): IpaComparison {
  const entries = loadCmudict().get(word.toLowerCase().replace(/[^a-z']/g, ''));
  if (!entries) return { unknown: true, consonantsMatch: true, stressMatch: true, expected: '' };
  const skeleton = consonantSkeleton(ipa);
  const stress = ipaStressIndex(ipa);
  const consonantsMatch = entries.some((e) => arpabetToSkeleton(e) === skeleton);
  const stressMatch =
    stress < 0 ||
    entries.some((e) => {
      const syllables = e.filter((p) => /\d$/.test(p)).length;
      // Monosyllables carry no stress mark in our transcriptions; CMU marks them as stressed.
      return syllables < 2 || cmuStressIndexes(e).includes(stress);
    });
  return {
    unknown: false,
    consonantsMatch,
    stressMatch,
    expected: entries.map((e) => e.join(' ')).join(' / '),
  };
}
