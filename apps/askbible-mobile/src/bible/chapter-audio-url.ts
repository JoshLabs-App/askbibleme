import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";

export function isAskBibleMeBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl.replace(/\/$/, "") || baseUrl).hostname.toLowerCase();
    return host === "askbible.me" || host.endsWith(".askbible.me");
  } catch {
    return /askbible\.me/i.test(baseUrl);
  }
}

/**
 * 圣经章朗读自托管基址：允许 askbible.me（语音包 / `/audio`），以及开发本机。
 * 与自然/音乐内容库分离——那些仍走 `getNatureRemoteAssetBaseUrl`（bundled-only 下为空）。
 */
export function isTrustedSelfHostedChapterAudioBase(baseUrl: string): boolean {
  const trimmed = baseUrl.trim();
  if (!trimmed) return false;
  if (isAskBibleMeBaseUrl(trimmed)) return true;
  if (__DEV__) return true;
  return false;
}

export function absoluteSelfHostedChapterAudioUrl(
  baseUrl: string,
  path: string,
): string | null {
  if (!isTrustedSelfHostedChapterAudioBase(baseUrl)) return null;
  const absolute = toAbsoluteUrl(baseUrl, path);
  return absolute || null;
}

/**
 * 整章朗读 / 金句音频站点根：可用主站（圣经音频白名单）。
 */
export function getChapterAudioBaseUrl(): string {
  return getAskBibleBaseUrl().replace(/\/$/, "");
}

/**
 * 自然场景静态资源站点根。内容本地包为空；不回落 askbible.me。
 */
export function getNatureRemoteAssetBaseUrl(): string {
  if (isMobileBundledOnly()) return "";
  const primary = getAskBibleBaseUrl().replace(/\/$/, "");
  if (!primary || isAskBibleMeBaseUrl(primary)) return "";
  return primary;
}

/** @deprecated 使用 `getNatureRemoteAssetBaseUrl` */
export function getNatureMediaBaseUrl(): string {
  return getNatureRemoteAssetBaseUrl();
}
