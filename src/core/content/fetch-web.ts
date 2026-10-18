/**
 * Downloads a content file on the website. Unit files carry a content hash in their names; when
 * the site is updated while a tab is open, the old files are gone and the host answers with its
 * page instead of JSON. The tab then reloads once to pick up the new version.
 */
export async function fetchContent<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) {
    reloadOnce(path);
    throw new Error(`${path}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function reloadOnce(path: string) {
  try {
    const key = `jane:reloaded-for:${path}`;
    // Once per file: if the new version misses it too, the learner sees the error instead of a loop.
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    location.reload();
  } catch {
    // Storage blocked (private mode in some browsers): show the error, do not risk a loop.
  }
}
