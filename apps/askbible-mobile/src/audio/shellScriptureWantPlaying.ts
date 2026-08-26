type Listener = () => void;

let wantPlaying = false;
const listeners = new Set<Listener>();

export function getShellScriptureWantPlaying(): boolean {
  return wantPlaying;
}

export function setShellScriptureWantPlaying(next: boolean): void {
  if (wantPlaying === next) return;
  wantPlaying = next;
  for (const cb of listeners) cb();
}

export function subscribeShellScriptureWantPlaying(onChange: Listener): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}
