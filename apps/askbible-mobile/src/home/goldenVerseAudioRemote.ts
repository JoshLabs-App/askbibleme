import {
  buildGoldenVerseAudioRelativePath,
  type GoldenVerseAudioTranslationId,
} from "@/lib/bible/golden-verse-audio";

/**
 * TEMPORARY STRATEGY（包体过大）：金句语音默认 R2 HTTPS 直链点播，不进安装包。
 * 恢复本地 zip / Android PAD 后：设 `EXPO_PUBLIC_GOLDEN_VERSE_AUDIO_STREAM=0` 并重新打包。
 * 禁止回落到 askbible.me / Render 流量计费。
 *
 * 上传后把公开基址写入 `EXPO_PUBLIC_GOLDEN_VERSE_AUDIO_BASE_URL`
 *（形如 `https://pub-….r2.dev`，对象键为 `audio/golden-verses/…`）。
 */
const HARDCODED_R2_PUBLIC_BASE =
  "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev";

/** 关屏后 JS 冻住；一次从金句池预取这么多句给原生，支撑关屏长播（勿为省流量随意下调）。 */
export const ANDROID_GOLDEN_VERSE_PREFETCH_COUNT = 120;
export const GOLDEN_VERSE_NATIVE_PREFETCH_COUNT = ANDROID_GOLDEN_VERSE_PREFETCH_COUNT;

export function isGoldenVerseAudioRemoteStreamEnabled(): boolean {
  const flag = process.env.EXPO_PUBLIC_GOLDEN_VERSE_AUDIO_STREAM?.trim();
  if (flag === "0") return false;
  if (flag === "1") return true;
  return true;
}

export function getGoldenVerseAudioRemoteBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_GOLDEN_VERSE_AUDIO_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return HARDCODED_R2_PUBLIC_BASE.replace(/\/$/, "");
}

export function buildGoldenVerseAudioRemoteUrl(
  verseKey: string,
  translationId: GoldenVerseAudioTranslationId = "cuv-simp",
): string | null {
  const base = getGoldenVerseAudioRemoteBaseUrl();
  if (!base) return null;
  const relative = buildGoldenVerseAudioRelativePath(verseKey, translationId);
  if (!relative) return null;
  return `${base}/audio/${relative}`;
}
