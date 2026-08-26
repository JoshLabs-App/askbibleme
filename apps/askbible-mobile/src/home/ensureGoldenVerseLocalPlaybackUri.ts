import { buildGoldenVerseAudioRelativePath } from "@/lib/bible/golden-verse-audio";
import type { GoldenVerseAudioTranslationId } from "@/lib/bible/golden-verse-audio";
import { fetchWithTimeout } from "../api/fetchWithTimeout";
import { ensureBundledGoldenVerseAudioFile } from "./ensureBundledGoldenVersePack";
import {
  buildGoldenVerseAudioRemoteUrl,
  isGoldenVerseAudioRemoteStreamEnabled,
} from "./goldenVerseAudioRemote";

function relativePathFromAudioUrl(url: string): string | null {
  const trimmed = url.trim();
  const match = trimmed.match(/\/audio\/(golden-verses(?:-web-en)?\/[^/?#]+)$/i);
  return match?.[1] ?? null;
}

async function uriFromBundledRelativePath(relativePath: string): Promise<string | null> {
  return ensureBundledGoldenVerseAudioFile(relativePath);
}

function isHttpsUrl(url: string): boolean {
  return /^https:\/\//i.test(url.trim());
}

/** R2 未上传的金句会 404；先 HEAD，避免原生播放器对着空文件静音。 */
async function remoteUrlIfPlayable(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, { method: "HEAD", timeoutMs: 4_000 });
    if (res.status === 404 || res.status === 410) return null;
  } catch {
    /* 网络抖动：仍交给播放器试 */
  }
  return url;
}

/**
 * 金句播放 URI。
 * TEMP：默认优先 R2 HTTPS 直链；若仍有安装包 zip 则本地优先（调试/回退）。
 * 禁止 askbible.me / Render 作常规下发。
 */
export async function ensureGoldenVerseLocalPlaybackUri(remoteUrl: string): Promise<string> {
  const trimmed = remoteUrl.trim();
  if (!trimmed) return trimmed;

  const relativeFromUrl = relativePathFromAudioUrl(trimmed);
  if (relativeFromUrl) {
    try {
      const bundled = await uriFromBundledRelativePath(relativeFromUrl);
      if (bundled) return bundled;
    } catch {
      /* missing local */
    }
  }

  if (isGoldenVerseAudioRemoteStreamEnabled() && isHttpsUrl(trimmed)) {
    return trimmed;
  }
  return "";
}

/** 按经文键解析可播 URI（本地包优先，否则 R2 直链）。 */
export async function resolveGoldenVersePlaybackUri(args: {
  verseKey: string;
  translationId: GoldenVerseAudioTranslationId;
  remoteUrl: string | null;
}): Promise<string | null> {
  const relative = buildGoldenVerseAudioRelativePath(args.verseKey, args.translationId);
  if (relative) {
    try {
      const bundled = await uriFromBundledRelativePath(relative);
      if (bundled) return bundled;
    } catch {
      /* fall through */
    }
  }

  if (isGoldenVerseAudioRemoteStreamEnabled()) {
    const streamed =
      buildGoldenVerseAudioRemoteUrl(args.verseKey, args.translationId) ||
      (args.remoteUrl?.trim() || null);
    if (streamed && isHttpsUrl(streamed)) {
      // R2 直链：勿 HEAD（~1s 延迟 + effect 重跑竞态 → 句中重复 userPlay 卡重播）。
      return streamed.trim();
    }
  }

  if (!args.remoteUrl) return null;
  const fromUrl = await ensureGoldenVerseLocalPlaybackUri(args.remoteUrl);
  return fromUrl || null;
}
