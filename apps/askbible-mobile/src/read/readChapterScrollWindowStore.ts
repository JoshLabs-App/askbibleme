type Listener = () => void;

let scrollY = 0;
let viewportH = 0;
let snapshot = { scrollY: 0, viewportH: 0 };
const listeners = new Set<Listener>();

export function getReadChapterScrollWindowSnapshot(): { scrollY: number; viewportH: number } {
  return snapshot;
}

export function publishReadChapterScrollWindow(nextY: number, nextViewportH?: number): void {
  const y = Math.max(0, nextY);
  const vh =
    nextViewportH != null && nextViewportH > 0 ? nextViewportH : viewportH;
  if (y === scrollY && vh === viewportH) return;
  scrollY = y;
  viewportH = vh;
  snapshot = { scrollY, viewportH };
  queueMicrotask(() => {
    for (const listener of listeners) listener();
  });
}

export function subscribeReadChapterScrollWindow(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
