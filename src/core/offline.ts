/**
 * Storing the whole course for offline use on the website. The service worker (dist/sw.js)
 * stores units as they are opened; this asks it to fetch all of them now. Not available in the
 * app (it has every unit inside) or on the development server (no service worker there).
 */
export interface OfflineProgress {
  done: number;
  total: number;
  failed: number;
}

/** Whether the site's service worker is running, so the course can be stored. */
export function canStoreCourse(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
}

export function storeWholeCourse(
  onProgress: (p: OfflineProgress) => void,
): Promise<OfflineProgress> {
  return new Promise((resolve, reject) => {
    const worker = navigator.serviceWorker?.controller;
    if (!worker) {
      reject(new Error('No service worker'));
      return;
    }
    const channel = new MessageChannel();
    channel.port1.onmessage = (e: MessageEvent<OfflineProgress & { finished?: boolean }>) => {
      onProgress(e.data);
      if (e.data.finished) {
        channel.port1.close();
        resolve(e.data);
      }
    };
    worker.postMessage({ type: 'cache-units' }, [channel.port2]);
  });
}
