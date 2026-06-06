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

/**
 * 自然场景静态资源（缩略图、资源包下载）的站点根 URL。
 * 成片播放仍只走 APK / 已下载包（见 `resolveNatureCoverPlayback`），此处仅用于拼路径与拉取更新包。
 */
export function getNatureRemoteAssetBaseUrl(): string {
  return getAskBibleBaseUrl().replace(/\/$/, "");
}

/** @deprecated 使用 `getNatureRemoteAssetBaseUrl` */
export function getNatureMediaBaseUrl(): string {
  return getNatureRemoteAssetBaseUrl();
}
