import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";

/** 生产自托管音轨：移动端直接拼 URL，避免 Android 上 HEAD/Range 探测失败 */
export function isTrustedSelfHostedChapterAudioBase(baseUrl: string): boolean {
  if (isMobileBundledOnly()) return false;
  try {
    const host = new URL(baseUrl.replace(/\/$/, "") || baseUrl).hostname.toLowerCase();
    return host === "askbible.me" || host.endsWith(".askbible.me");
  } catch {
    return false;
  }
}

export function absoluteSelfHostedChapterAudioUrl(
  baseUrl: string,
  path: string,
): string | null {
  if (isMobileBundledOnly()) return null;
  if (!isTrustedSelfHostedChapterAudioBase(baseUrl)) return null;
  const absolute = toAbsoluteUrl(baseUrl, path);
  return absolute || null;
}

/**
 * 整章朗读音轨：纯本地包不拼远程 URL；开发模式可走本机 / 线上。
 */
export function getChapterAudioBaseUrl(): string {
  if (isMobileBundledOnly()) return "";
  const base = getAskBibleBaseUrl().replace(/\/$/, "");
  if (isTrustedSelfHostedChapterAudioBase(base)) return base;
  if (__DEV__) return base;
  return "";
}

function isLocalDevAskBibleBase(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl.replace(/\/$/, "") || baseUrl);
    const h = u.hostname.trim().toLowerCase();
    if (!h) return true;
    if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return true;
    if (h.startsWith("10.") || h.startsWith("192.168.")) return true;
    const m = h.match(/^172\.(\d+)\./);
    if (m) {
      const octet = Number(m[1]);
      if (Number.isFinite(octet) && octet >= 16 && octet <= 31) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 自然场景静态资源（缩略图、资源包下载）的站点根 URL。
 * 成片播放仍只走 APK / 已下载包（见 `resolveNatureCoverPlayback`），此处仅用于拼路径与拉取更新包。
 * 模拟器联调 localhost 时默认改走 askbible.me，避免本机未起 dev 时缩略图全失败。
 */
export function getNatureRemoteAssetBaseUrl(): string {
  const primary = getAskBibleBaseUrl().replace(/\/$/, "");
  if (__DEV__ && isLocalDevAskBibleBase(primary)) {
    return "https://askbible.me";
  }
  return primary;
}

/** @deprecated 使用 `getNatureRemoteAssetBaseUrl` */
export function getNatureMediaBaseUrl(): string {
  return getNatureRemoteAssetBaseUrl();
}
