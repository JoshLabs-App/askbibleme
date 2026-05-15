export const DEVICE_PLAYBACK_STORAGE_KEY = "selah-device-playback-v1";

export type DevicePlaybackPersistedV1 = {
  v: 1;
  trackId: string;
  timeSec: number;
  wasPlaying: boolean;
};

export function readDevicePlaybackPersisted(): DevicePlaybackPersistedV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEVICE_PLAYBACK_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<DevicePlaybackPersistedV1>;
    if (o.v !== 1 || typeof o.trackId !== "string" || !o.trackId.trim()) return null;
    const timeSec = typeof o.timeSec === "number" && Number.isFinite(o.timeSec) ? Math.max(0, o.timeSec) : 0;
    return {
      v: 1,
      trackId: o.trackId.trim(),
      timeSec,
      wasPlaying: Boolean(o.wasPlaying),
    };
  } catch {
    return null;
  }
}

export function writeDevicePlaybackPersisted(payload: DevicePlaybackPersistedV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEVICE_PLAYBACK_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearDevicePlaybackPersisted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DEVICE_PLAYBACK_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
