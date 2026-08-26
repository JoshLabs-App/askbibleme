const STORAGE_KEY = "askbible-nature-home-live-video-v1";
export const NATURE_HOME_LIVE_VIDEO_PREFS_EVENT = "askbible:nature-home-live-video-updated";

/** 默认开：开 App 直接播循环视频；点模糊图标才切预烘焙静帧。 */
export const DEFAULT_NATURE_LIVE_VIDEO = true;

export function readNatureLiveVideoEnabled(): boolean {
  if (typeof window === "undefined") return DEFAULT_NATURE_LIVE_VIDEO;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_NATURE_LIVE_VIDEO;
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
    return DEFAULT_NATURE_LIVE_VIDEO;
  } catch {
    return DEFAULT_NATURE_LIVE_VIDEO;
  }
}

export function writeNatureLiveVideoEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    window.dispatchEvent(new Event(NATURE_HOME_LIVE_VIDEO_PREFS_EVENT));
  } catch {
    /* ignore unavailable storage */
  }
}
