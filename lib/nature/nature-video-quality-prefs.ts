const STORAGE_KEY = "selah-nature-bg-1080-v1";

/** 自然全屏背景：在条目含 `src1080` 时是否优先播 1080p（更耗流量与解码）。 */
export function readNatureBackground1080Pref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeNatureBackground1080Pref(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* quota / private mode */
  }
}
