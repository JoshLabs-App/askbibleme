/** 互斥策略：`normal` 不改变现有手机/桌面行为；`strictExclusive` 用于电视等单管线设备。 */
export type MediaPlaybackPolicyTier = "normal" | "strictExclusive";

const TV_UA_RE =
  /Smart-?TV|SMART-TV|SmartTV|Tizen|Web0S|webOS|NetCast|BRAVIA|Viera|HbbTV|Roku|CrKey|GoogleTV|AppleTV|AFTT|AFTB|AFTM|AFTS|Silk\/|Kindle|PlayStation|Xbox|VIDAA|Opera TV/i;

function isIosTabletOrPhoneUa(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua);
}

/**
 * 手机 / 平板（含 iPad）：永不进入 strict，避免方案 A 影响现有「动图 + 音乐」体验。
 */
export function isLikelyMobilePhoneUserAgent(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  if (!ua) return false;
  if (isIosTabletOrPhoneUa(ua)) return true;
  if (/Android/i.test(ua)) {
    if (/TV|AFT/i.test(ua)) return false;
    if (/Mobile/i.test(ua)) return true;
    // 部分 Android 手机 UA 无 Mobile，但也不是 TV
    return !TV_UA_RE.test(ua);
  }
  if (/Mobile|iPhone|iPod|Windows Phone/i.test(ua)) return true;
  return false;
}

/** 电视 / 机顶盒 / 游戏主机浏览器等：通常无法稳定双路媒体。 */
export function isTvLikeUserAgent(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  if (!ua) return false;
  if (isLikelyMobilePhoneUserAgent(ua)) return false;
  return TV_UA_RE.test(ua);
}

/**
 * 解析媒体互斥档位。手机恒为 `normal`；电视为 `strictExclusive`；桌面默认 `normal`。
 */
export function resolveMediaPlaybackPolicyTier(
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
): MediaPlaybackPolicyTier {
  if (!ua || isLikelyMobilePhoneUserAgent(ua)) return "normal";
  if (isTvLikeUserAgent(ua)) return "strictExclusive";
  return "normal";
}
