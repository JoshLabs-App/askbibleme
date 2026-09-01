import { parseVerseKey } from "./parse-verse-key";

export const GOLDEN_VERSE_AUDIO_SUBDIR = "golden-verses";
export const GOLDEN_VERSE_WEBP_AUDIO_SUBDIR = "golden-verses-web-en";
export const GOLDEN_VERSE_AUDIO_SUFFIX = "-32kbps.mp3";

export type GoldenVerseAudioTranslationId = "cuv-simp" | "web-en";

function buildGoldenVerseAudioFilename(verseKey: string): string | null {
  const loc = parseVerseKey(verseKey);
  if (!loc) return null;
  return `${loc.bookId}-${loc.chapter}-${loc.verse}${GOLDEN_VERSE_AUDIO_SUFFIX}`;
}

export function buildGoldenVerseAudioRelativePath(
  verseKey: string,
  translationId: GoldenVerseAudioTranslationId = "cuv-simp",
): string | null {
  const filename = buildGoldenVerseAudioFilename(verseKey);
  if (!filename) return null;
  const subdir =
    translationId === "web-en" ? GOLDEN_VERSE_WEBP_AUDIO_SUBDIR : GOLDEN_VERSE_AUDIO_SUBDIR;
  return `${subdir}/${filename}`;
}

export function buildGoldenVerseAudioSrc(
  verseKey: string,
  translationId: GoldenVerseAudioTranslationId = "cuv-simp",
): string | null {
  const relativePath = buildGoldenVerseAudioRelativePath(verseKey, translationId);
  if (!relativePath) return null;
  return `/audio/${relativePath}`;
}

/** 与移动端共用的公开 R2 桶（见 apps/askbible-mobile/src/home/goldenVerseAudioRemote.ts）。 */
const GOLDEN_VERSE_AUDIO_R2_PUBLIC_BASE = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev";

export function goldenVerseAudioRemoteBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_GOLDEN_VERSE_AUDIO_BASE_URL?.trim();
  return (fromEnv || GOLDEN_VERSE_AUDIO_R2_PUBLIC_BASE).replace(/\/$/, "");
}

/** 直连 R2，不经过 askbible.me 存放/转发。 */
export function buildGoldenVerseAudioRemoteSrc(
  verseKey: string,
  translationId: GoldenVerseAudioTranslationId = "cuv-simp",
): string | null {
  const relativePath = buildGoldenVerseAudioRelativePath(verseKey, translationId);
  if (!relativePath) return null;
  return `${goldenVerseAudioRemoteBaseUrl()}/audio/${relativePath}`;
}
