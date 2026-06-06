type Listener = () => void;

const listeners = new Set<Listener>();
let active = false;

export function getMusicAutoHideChrome(): boolean {
  return active;
}

export function setMusicAutoHideChrome(next: boolean): void {
  if (active === next) return;
  active = next;
  listeners.forEach((listener) => listener());
}

export function subscribeMusicAutoHideChrome(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isMusicShellPath(pathname: string): boolean {
  const p = pathname || "";
  return p === "/music" || p.startsWith("/music/");
}
