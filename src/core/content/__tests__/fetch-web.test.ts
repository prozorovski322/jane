import { fetchContent } from '../fetch-web';

const response = (status: number, type: string, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => type },
    json: async () => body,
  }) as unknown as Response;

describe('fetchContent', () => {
  const store = new Map<string, string>();
  const reload = jest.fn();

  beforeEach(() => {
    store.clear();
    reload.mockClear();
    Object.assign(globalThis, {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      location: { reload },
    });
  });

  it('returns the JSON of a content file', async () => {
    globalThis.fetch = jest.fn(async () => response(200, 'application/json', { id: 'a1.u01' }));
    await expect(fetchContent('/content/units/a1.u01.abc.json')).resolves.toEqual({ id: 'a1.u01' });
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads once when an updated site no longer has the file', async () => {
    // The host answers a missing file with its page (the single-page fallback).
    globalThis.fetch = jest.fn(async () => response(200, 'text/html', '<!doctype html>'));
    await expect(fetchContent('/content/units/a1.u01.old.json')).rejects.toThrow();
    expect(reload).toHaveBeenCalledTimes(1);
    // The new version misses it too: show the error instead of reloading in a loop.
    await expect(fetchContent('/content/units/a1.u01.old.json')).rejects.toThrow();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('treats a 404 the same way', async () => {
    globalThis.fetch = jest.fn(async () => response(404, 'application/json', null));
    await expect(fetchContent('/content/units/x.json')).rejects.toThrow('HTTP 404');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
