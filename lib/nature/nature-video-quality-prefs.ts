const STORAGE_KEY = "selah-nature-bg-1080-v1";

/** 用户显式开启 1080；未设置时默认 720。 */
const STORAGE_ON = "1";

/** 旧版：localStorage 存 `"0"` 表示强制 720，与新默认一致，读取时忽略即可。 */
const STORAGE_LEGACY_FORCE_720 = "0";

export const NATURE_BACKGROUND_1080_PREF_UPDATED_EVENT = "selah-nature-bg-1080-pref-updated";

/**
 * 自然全屏背景：在条目含 `src1080` 时是否使用 1080p。
 * 默认 false（720p）；仅当用户打开右上角「1080」时为 true。
 */
export function readNatureBackground1080Pref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === STORAGE_LEGACY_FORCE_720) return false;
    return v === STORAGE_ON;
  } catch {
    return false;
  }
}

export function writeNatureBackground1080Pref(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, STORAGE_ON);
    else window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(NATURE_BACKGROUND_1080_PREF_UPDATED_EVENT));
  } catch {
    /* quota / private mode */
  }
}
