/** localStorage 键：官方电视 App 写入后，Web 端用 `normal` 媒体策略（背景视频 + 壳层音乐并存）。 */
const ASKBIBLE_TV_CLIENT_STORAGE_KEY = "askbible_tv_client";
const ASKBIBLE_TV_CLIENT_IDS = new Set(["lg-webos"]);

function isAskbibleOfficialTvClient(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(ASKBIBLE_TV_CLIENT_STORAGE_KEY);
    return Boolean(raw && ASKBIBLE_TV_CLIENT_IDS.has(raw));
  } catch {
    return false;
  }
}

/**
 * - `normal`：手机/桌面/官方 TV App，背景静音视频与壳层音乐可同时存在。
 * - `tvCoexist`：电视浏览器等：起播音乐前短暂让出视频，音乐在播时改静图。
 */
export type MediaPlaybackPolicyTier = "normal" | "tvCoexist";

const TV_UA_RE =
  /Smart-?TV|SMART-TV|SmartTV|Tizen|Web0S|webOS|NetCast|BRAVIA|Viera|HbbTV|Roku|CrKey|GoogleTV|AppleTV|AFTT|AFTB|AFTM|AFTS|Silk\/|Kindle|PlayStation|Xbox|VIDAA|Opera TV/i;

function isIosTabletOrPhoneUa(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua);
}

/**
 * 手机 / 平板（含 iPad）：永不进入 TV 协调，避免影响「动图 + 音乐」。
 */
export function isLikelyMobilePhoneUserAgent(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  if (!ua) return false;
  if (isIosTabletOrPhoneUa(ua)) return true;
  if (/Android/i.test(ua)) {
    if (/TV|AFT/i.test(ua)) return false;
    if (/Mobile/i.test(ua)) return true;
    return !TV_UA_RE.test(ua);
  }
  if (/Mobile|iPhone|iPod|Windows Phone/i.test(ua)) return true;
  return false;
}

/** 电视 / 机顶盒 / 游戏主机浏览器等。 */
export function isTvLikeUserAgent(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  if (!ua) return false;
  if (isLikelyMobilePhoneUserAgent(ua)) return false;
  return TV_UA_RE.test(ua);
}

/**
 * 解析媒体策略。手机恒为 `normal`；电视为 `tvCoexist`；桌面默认 `normal`。
 */
export function resolveMediaPlaybackPolicyTier(
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
): MediaPlaybackPolicyTier {
  if (isAskbibleOfficialTvClient()) return "normal";
  if (!ua || isLikelyMobilePhoneUserAgent(ua)) return "normal";
  if (isTvLikeUserAgent(ua)) return "tvCoexist";
  return "normal";
}
