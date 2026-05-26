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
 * 自然场景视频/海报：纯本地包仅用 require 资源，不拼 askbible.me。
 */
export function getNatureMediaBaseUrl(): string {
  if (isMobileBundledOnly()) return "";
  const base = getAskBibleBaseUrl().replace(/\/$/, "");
  if (isTrustedSelfHostedChapterAudioBase(base)) return base;
  if (__DEV__) return base;
  return "";
}
