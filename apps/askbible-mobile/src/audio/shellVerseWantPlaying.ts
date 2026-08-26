type Listener = () => void;

let wantPlaying = false;
const listeners = new Set<Listener>();

export function getShellVerseWantPlaying(): boolean {
  return wantPlaying;
}

export function setShellVerseWantPlaying(next: boolean): void {
  if (wantPlaying === next) return;
  wantPlaying = next;
  for (const cb of listeners) cb();
}

export function subscribeShellVerseWantPlaying(onChange: Listener): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}
