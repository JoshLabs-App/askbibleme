import type { MusicCompanionStore } from "./types";

export const SHELL_PLAYBACK_STORAGE_KEY = "selah-shell-playback-v1";

export type ShellPlaybackPersistedV1 = {
  v: 1;
  src: string;
  timeSec: number;
  wasPlaying: boolean;
};

function urlsEqual(a: string, b: string): boolean {
  const x = a.trim();
  const y = b.trim();
  if (!x || !y) return false;
  if (typeof window === "undefined") return x === y;
  try {
    return new URL(x, window.location.href).href === new URL(y, window.location.href).href;
  } catch {
    return x === y;
  }
}

export function isTrackSrcInStore(store: MusicCompanionStore, src: string): boolean {
  const s = src.trim();
  if (!s) return false;
  return store.audioTracks.some((t) => {
    const u = t.src?.trim() ?? "";
    return u && urlsEqual(u, s);
  });
}

export function readShellPlaybackPersisted(): ShellPlaybackPersistedV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SHELL_PLAYBACK_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<ShellPlaybackPersistedV1>;
    if (o.v !== 1 || typeof o.src !== "string" || !o.src.trim()) return null;
    const timeSec = typeof o.timeSec === "number" && Number.isFinite(o.timeSec) ? Math.max(0, o.timeSec) : 0;
    return {
      v: 1,
      src: o.src.trim(),
      timeSec,
      wasPlaying: Boolean(o.wasPlaying),
    };
  } catch {
    return null;
  }
}

export function writeShellPlaybackPersisted(payload: ShellPlaybackPersistedV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SHELL_PLAYBACK_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearShellPlaybackPersisted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SHELL_PLAYBACK_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export { urlsEqual as shellPlaybackUrlsEqual };
