/**
 * Generates Jane's own short sound effects as 16-bit mono WAV files (assets/sounds/*.wav).
 * Every sound is synthesized here from sine waves with a soft envelope, so there is nothing to
 * license and the files can be regenerated: `npm run sounds:build`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RATE = 22_050;

interface Note {
  /** Frequency in Hz. */
  hz: number;
  /** Start time in seconds. */
  at: number;
  /** Length in seconds. */
  length: number;
  gain?: number;
}

/** A soft bell-like tone: a sine with a quiet octave, a quick attack and an exponential decay. */
function render(notes: Note[], total: number): Float32Array {
  const out = new Float32Array(Math.ceil(total * RATE));
  for (const n of notes) {
    const start = Math.floor(n.at * RATE);
    const len = Math.floor(n.length * RATE);
    for (let i = 0; i < len && start + i < out.length; i++) {
      const t = i / RATE;
      const attack = Math.min(1, t / 0.008);
      const decay = Math.exp((-4.5 * t) / n.length);
      // A short fade at the very end avoids a click when the file stops.
      const tail = Math.min(1, (len - i) / (0.01 * RATE));
      const tone = Math.sin(2 * Math.PI * n.hz * t) + 0.25 * Math.sin(2 * Math.PI * n.hz * 2 * t);
      out[start + i]! += tone * attack * decay * tail * (n.gain ?? 1);
    }
  }
  return out;
}

function toWav(samples: Float32Array, peak = 0.55): Buffer {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  const scale = max ? peak / max : 1;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(s * scale * 32767), i * 2));

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const note = (name: string): number => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const m = /^([A-G]#?)(\d)$/.exec(name)!;
  const midi = names.indexOf(m[1]!) + (Number(m[2]) + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
};

export const SOUNDS: Record<string, Float32Array> = {
  // Two rising notes: a friendly "yes".
  correct: render(
    [
      { hz: note('E5'), at: 0, length: 0.16 },
      { hz: note('A5'), at: 0.09, length: 0.26 },
    ],
    0.4,
  ),
  // One soft, low, falling note: "not quite", never harsh.
  wrong: render(
    [
      { hz: note('A3'), at: 0, length: 0.14, gain: 0.9 },
      { hz: note('F3'), at: 0.1, length: 0.26, gain: 0.8 },
    ],
    0.4,
  ),
  // A rising arpeggio for a finished lesson.
  complete: render(
    ['C5', 'E5', 'G5', 'C6'].map((n, i) => ({
      hz: note(n),
      at: i * 0.1,
      length: i === 3 ? 0.6 : 0.25,
    })),
    1.0,
  ),
  // A little sparkle for an achievement.
  achievement: render(
    ['E6', 'G6', 'B6', 'E7'].map((n, i) => ({
      hz: note(n),
      at: i * 0.07,
      length: 0.3,
      gain: 0.7 + i * 0.1,
    })),
    0.7,
  ),
};

if (process.argv[1]?.endsWith('gen-sounds.ts')) {
  const dir = join(process.cwd(), 'assets', 'sounds');
  mkdirSync(dir, { recursive: true });
  for (const [name, samples] of Object.entries(SOUNDS)) {
    writeFileSync(join(dir, `${name}.wav`), toWav(samples));
    console.log(`assets/sounds/${name}.wav  ${(samples.length / RATE).toFixed(2)} s`);
  }
}

export { toWav };
