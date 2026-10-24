/** expo-sqlite's OPFS handle pool is exclusive to one document, even for different DB names. */
const LOCK_NAME = 'jane-sqlite-opfs';

interface DbLockManager {
  request(
    name: string,
    options: { ifAvailable: true },
    callback: (lock: object | null) => Promise<void>,
  ): Promise<void>;
}

export class DatabaseInUseError extends Error {
  constructor() {
    super(
      'Курс уже открыт в другой вкладке. Вернитесь в неё или закройте её и обновите эту страницу.',
    );
    this.name = 'DatabaseInUseError';
  }
}

/** Hold the browser lock for the connection lifetime. A document closing releases it too. */
export function acquireWebDatabaseLease(
  manager: DbLockManager | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.locks,
): Promise<() => void> {
  if (!manager) return Promise.resolve(() => {});
  return new Promise((resolve, reject) => {
    void manager
      .request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          reject(new DatabaseInUseError());
          return;
        }
        await new Promise<void>((release) => resolve(release));
      })
      .catch(reject);
  });
}

export function storageBootMessage(message: string): string {
  if (/Invalid VFS state/i.test(message)) {
    return 'Не удалось запустить хранилище браузера. Обновите страницу, чтобы открыть его заново. Данные при этом не очищаются.';
  }
  if (/NoModificationAllowedError|another open Access Handle/i.test(message)) {
    return new DatabaseInUseError().message;
  }
  return message;
}
