const STORAGE_KEY = "selah-nature-bg-1080-v1";

/** 用户显式选择 720（关闭高清）；未设置时默认 1080。 */
const STORAGE_FORCE_720 = "0";

/**
 * 自然全屏背景：在条目含 `src1080` 时是否优先 1080p。
 * 默认 true；仅当用户曾关闭「1080」按钮时为 false。
 */
export function readNatureBackground1080Pref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== STORAGE_FORCE_720;
  } catch {
    return true;
  }
}

export function writeNatureBackground1080Pref(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, STORAGE_FORCE_720);
  } catch {
    /* quota / private mode */
  }
}
