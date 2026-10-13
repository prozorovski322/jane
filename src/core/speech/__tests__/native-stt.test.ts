import {
  createNativeRecognizer,
  type NativeResultEvent,
  type NativeSpeechModule,
} from '../native-stt';
import { SpeechError } from '../stt';

type Handlers = {
  result?: (e: NativeResultEvent) => void;
  error?: (e: { error: string; message: string }) => void;
  end?: () => void;
};

function fakeModule(
  over: { onDevice?: boolean; available?: boolean; granted?: boolean } = {},
): NativeSpeechModule & { handlers: Handlers; started: unknown[]; removed: number } {
  const handlers: Handlers = {};
  const fake = {
    handlers,
    started: [] as unknown[],
    removed: 0,
    start: (o: unknown) => void fake.started.push(o),
    stop: jest.fn(),
    abort: jest.fn(),
    addListener: (event: keyof Handlers, cb: never) => {
      (handlers as Record<string, unknown>)[event] = cb;
      return { remove: () => void fake.removed++ };
    },
    requestPermissionsAsync: async () => ({ granted: over.granted ?? true }),
    isRecognitionAvailable: () => over.available ?? true,
    supportsOnDeviceRecognition: () => over.onDevice ?? true,
  };
  return fake as unknown as ReturnType<typeof fakeModule>;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('native recognizer', () => {
  it('is available on-device without asking for cloud consent', async () => {
    const r = createNativeRecognizer(fakeModule({ onDevice: true }), () => false);
    expect(await r.isAvailable()).toBe(true);
  });

  it('is unavailable when only the cloud could do it and the learner has not allowed that', async () => {
    const mod = fakeModule({ onDevice: false });
    expect(await createNativeRecognizer(mod, () => false).isAvailable()).toBe(false);
    expect(await createNativeRecognizer(mod, () => true).isAvailable()).toBe(true);
  });

  it('refuses to listen without cloud consent instead of sending audio away', async () => {
    const mod = fakeModule({ onDevice: false });
    const r = createNativeRecognizer(mod, () => false);
    await expect(r.listen({ lang: 'en-US' })).rejects.toMatchObject({ code: 'unavailable' });
    expect(mod.started).toHaveLength(0);
  });

  it('requires on-device recognition whenever the device supports it', async () => {
    const mod = fakeModule({ onDevice: true });
    const p = createNativeRecognizer(mod).listen({ lang: 'en-US', contextualStrings: ['hello'] });
    await tick();
    expect(mod.started[0]).toMatchObject({
      lang: 'en-US',
      requiresOnDeviceRecognition: true,
      interimResults: true,
      contextualStrings: ['hello'],
    });
    mod.handlers.result!({ isFinal: true, results: [{ transcript: 'hello' }] });
    await expect(p).resolves.toBe('hello');
    expect(mod.removed).toBe(3);
  });

  it('reports interim text and resolves with the final result', async () => {
    const mod = fakeModule();
    const interim: string[] = [];
    const p = createNativeRecognizer(mod).listen({
      lang: 'en-US',
      onInterim: (t) => interim.push(t),
    });
    await tick();
    mod.handlers.result!({ isFinal: false, results: [{ transcript: 'my name' }] });
    mod.handlers.result!({ isFinal: true, results: [{ transcript: 'my name is Anna' }] });
    await expect(p).resolves.toBe('my name is Anna');
    expect(interim).toEqual(['my name']);
  });

  it('keeps what was heard when the session ends or reports no-speech afterwards', async () => {
    const mod = fakeModule();
    const p = createNativeRecognizer(mod).listen({ lang: 'en-US' });
    await tick();
    mod.handlers.result!({ isFinal: false, results: [{ transcript: 'good morning' }] });
    mod.handlers.error!({ error: 'no-speech', message: '' });
    await expect(p).resolves.toBe('good morning');
  });

  it('rejects with no-speech when nothing was heard', async () => {
    const mod = fakeModule();
    const p = createNativeRecognizer(mod).listen({ lang: 'en-US' });
    await tick();
    mod.handlers.end!();
    await expect(p).rejects.toMatchObject({ code: 'no-speech' });
  });

  it('maps native errors to app errors', async () => {
    const mod = fakeModule();
    const p = createNativeRecognizer(mod).listen({ lang: 'en-US' });
    await tick();
    mod.handlers.error!({ error: 'network', message: 'offline' });
    await expect(p).rejects.toBeInstanceOf(SpeechError);
    await expect(p).rejects.toMatchObject({ code: 'network' });
  });

  it('rejects with not-allowed when the permission is refused', async () => {
    const mod = fakeModule({ granted: false });
    await expect(createNativeRecognizer(mod).listen({ lang: 'en-US' })).rejects.toMatchObject({
      code: 'not-allowed',
    });
    expect(mod.started).toHaveLength(0);
  });
});
