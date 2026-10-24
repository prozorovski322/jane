import { acquireWebDatabaseLease, DatabaseInUseError, storageBootMessage } from '../web-db-lock';

it('prevents a second document from entering the OPFS pool until the first releases it', async () => {
  let occupied = false;
  const manager = {
    request: async (
      _name: string,
      _options: { ifAvailable: true },
      fn: (lock: object | null) => Promise<void>,
    ) => {
      if (occupied) {
        await fn(null);
        return;
      }
      occupied = true;
      try {
        await fn({});
      } finally {
        occupied = false;
      }
    },
  };
  const release = await acquireWebDatabaseLease(manager);
  expect(occupied).toBe(true);
  await expect(acquireWebDatabaseLease(manager)).rejects.toBeInstanceOf(DatabaseInUseError);
  release();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const nextRelease = await acquireWebDatabaseLease(manager);
  nextRelease();
});

it('does not block browsers without Web Locks and propagates real lock failures', async () => {
  const release = await acquireWebDatabaseLease(undefined);
  expect(typeof release).toBe('function');
  release();
  await expect(
    acquireWebDatabaseLease({
      request: async () => {
        throw new Error('storage unavailable');
      },
    }),
  ).rejects.toThrow('storage unavailable');
});

it('explains worker recovery and tab contention without suggesting data deletion', () => {
  expect(storageBootMessage('Error: Invalid VFS state')).toContain('Данные при этом не очищаются');
  expect(storageBootMessage('NoModificationAllowedError: another open Access Handle')).toContain(
    'другой вкладке',
  );
  expect(storageBootMessage('migration failure')).toBe('migration failure');
});
