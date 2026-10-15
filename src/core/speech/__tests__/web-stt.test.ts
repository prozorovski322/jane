import { SpeechError } from '../stt';
import { createWebRecognizer, type BrowserRecognition, type BrowserResultEvent } from '../web-stt';

/** A stand-in for the browser's SpeechRecognition; the last one created is kept for the test. */
let last: FakeRecognition | null = null;
class FakeRecognition implements BrowserRecognition {
  lang = '';
  interimResults = false;
  continuous = true;
  maxAlternatives = 0;
  onresult: BrowserRecognition['onresult'] = null;
  onerror: BrowserRecognition['onerror'] = null;
  onend: BrowserRecognition['onend'] = null;
  started = 0;
  stopped = 0;
  constructor() {
    last = this;
  }
  start() {
    this.started++;
  }
  stop() {
    this.stopped++;
    this.onend?.();
  }
  abort() {}
}

function result(parts: { text: string; final: boolean }[]): BrowserResultEvent {
  return {
    resultIndex: 0,
    results: parts.map((p) => Object.assign([{ transcript: p.text }], { isFinal: p.final })),
  };
}

beforeEach(() => {
  last = null;
});

describe('web recognizer', () => {
  it('is available only when the learner has allowed browser recognition', async () => {
    expect(await createWebRecognizer(FakeRecognition, () => false).isAvailable()).toBe(false);
    expect(await createWebRecognizer(FakeRecognition, () => true).isAvailable()).toBe(true);
  });

  it('refuses to listen without consent instead of sending audio away', async () => {
    const r = createWebRecognizer(FakeRecognition, () => false);
    await expect(r.listen({ lang: 'en-US' })).rejects.toMatchObject({ code: 'unavailable' });
    expect(last).toBeNull();
  });

  it('listens in English for one phrase and resolves with the final transcript', async () => {
    const interim: string[] = [];
    const p = createWebRecognizer(FakeRecognition, () => true).listen({
      lang: 'en-US',
      onInterim: (t) => interim.push(t),
    });
    const rec = last!;
    expect(rec.started).toBe(1);
    expect(rec.lang).toBe('en-US');
    expect(rec.continuous).toBe(false);
    expect(rec.interimResults).toBe(true);
    rec.onresult!(result([{ text: 'my suitcase', final: false }]));
    rec.onresult!(result([{ text: "My suitcase hasn't arrived", final: true }]));
    await expect(p).resolves.toBe("My suitcase hasn't arrived");
    expect(interim).toEqual(['my suitcase']);
  });

  it('joins the parts of a phrase the browser splits into several results', async () => {
    const p = createWebRecognizer(FakeRecognition, () => true).listen({ lang: 'en-US' });
    last!.onresult!(
      result([
        { text: 'I have been', final: true },
        { text: ' to Rome', final: true },
      ]),
    );
    await expect(p).resolves.toBe('I have been to Rome');
  });

  it('keeps a partial result when the browser then reports no speech', async () => {
    const p = createWebRecognizer(FakeRecognition, () => true).listen({ lang: 'en-US' });
    last!.onresult!(result([{ text: 'good morning', final: false }]));
    last!.onerror!({ error: 'no-speech' });
    await expect(p).resolves.toBe('good morning');
  });

  it('reports a blocked microphone as not allowed', async () => {
    const p = createWebRecognizer(FakeRecognition, () => true).listen({ lang: 'en-US' });
    last!.onerror!({ error: 'not-allowed' });
    await expect(p).rejects.toBeInstanceOf(SpeechError);
    await expect(p).rejects.toMatchObject({ code: 'not-allowed' });
  });

  it('rejects with no-speech when the browser ends without hearing anything', async () => {
    const p = createWebRecognizer(FakeRecognition, () => true).listen({ lang: 'en-US' });
    last!.onend!();
    await expect(p).rejects.toMatchObject({ code: 'no-speech' });
  });

  it('stop() ends listening and delivers what was heard so far', async () => {
    const r = createWebRecognizer(FakeRecognition, () => true);
    const p = r.listen({ lang: 'en-US' });
    last!.onresult!(result([{ text: 'thank you', final: false }]));
    r.stop();
    await expect(p).resolves.toBe('thank you');
    expect(last!.stopped).toBe(1);
  });
});
