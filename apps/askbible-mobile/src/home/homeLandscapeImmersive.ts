type Listener = () => void;

const listeners = new Set<Listener>();
let active = false;
let autoHideChrome = false;

export function getHomeLandscapeImmersive(): boolean {
  return active;
}

export function setHomeLandscapeImmersive(next: boolean): void {
  if (active === next) return;
  active = next;
  listeners.forEach((l) => l());
}

export function getHomeAutoHideChrome(): boolean {
  return autoHideChrome;
}

export function setHomeAutoHideChrome(next: boolean): void {
  if (autoHideChrome === next) return;
  autoHideChrome = next;
  listeners.forEach((l) => l());
}

export function subscribeHomeLandscapeImmersive(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
