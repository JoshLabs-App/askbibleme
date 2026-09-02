import { buildGoldenVerseAudioRelativePath } from "@/lib/bible/golden-verse-audio";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
import {
  buildGoldenVerseAudioRemoteUrl,
  isGoldenVerseAudioRemoteStreamEnabled,
} from "./goldenVerseAudioRemote";

export function resolveGoldenVerseAudioUrl(
  baseUrl: string,
  verseKey: string | null,
  translationId: "cuv-simp" | "web-en",
): string | null {
  if (!verseKey) return null;
  // TEMP：包体过大时默认 R2 直链；禁止回落 askbible.me / Render。
  if (isGoldenVerseAudioRemoteStreamEnabled()) {
    return buildGoldenVerseAudioRemoteUrl(verseKey, translationId);
  }
  // Stream off：仅允许显式非 askbible.me 基址（本地调试 / 自建），否则失败关闭。
  const relative = buildGoldenVerseAudioRelativePath(verseKey, translationId);
  if (!relative) return null;
  const base = baseUrl.trim();
  if (!base) return null;
  if (/askbible\.me/i.test(base)) return null;
  return toAbsoluteUrl(base, `/audio/${relative}`);
}

const VERSE_END_SLACK_MS = 350;

export function isNearNaturalEnd(status: {
  durationMillis?: number | null;
  positionMillis?: number;
}): boolean {
  const duration = status.durationMillis ?? 0;
  const position = status.positionMillis ?? 0;
  return duration > 400 && position >= duration - VERSE_END_SLACK_MS;
}
