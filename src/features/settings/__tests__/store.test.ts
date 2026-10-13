import type { Db } from '@/core/storage/db';
import { kvGet, kvSet } from '@/core/storage/kv';
import { migrate } from '@/core/storage/migrations';
import { openNodeDb } from '@/core/storage/node-db';

import { bindSettings, DEFAULT_SETTINGS, useSettings } from '../store';

let db: Db;
let unbind: () => void;

beforeEach(async () => {
  db = openNodeDb();
  await migrate(db);
  useSettings.setState(DEFAULT_SETTINGS);
});
afterEach(async () => {
  unbind?.();
  await db.close();
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('settings persistence', () => {
  it('starts with defaults and saves every change', async () => {
    unbind = await bindSettings(db);
    expect(useSettings.getState().theme).toBe('system');
    useSettings.getState().update({ theme: 'dark', speechRate: 0.7 });
    await flush();
    expect(await kvGet(db, 'settings', {})).toMatchObject({ theme: 'dark', speechRate: 0.7 });
  });

  it('loads saved values and ignores unknown or mistyped ones', async () => {
    await kvSet(db, 'settings', {
      theme: 'light',
      haptics: 'yes',
      voice: 'com.voice.ava',
      removedOption: 1,
    });
    unbind = await bindSettings(db);
    const s = useSettings.getState();
    expect(s.theme).toBe('light');
    expect(s.haptics).toBe(true); // mistyped value falls back to the default
    expect(s.voice).toBe('com.voice.ava');
    expect(s).not.toHaveProperty('removedOption');
  });
});
