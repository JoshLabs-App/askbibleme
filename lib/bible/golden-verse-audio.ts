import { parseVerseKey } from "@/lib/bible/parse-verse-key";

export const GOLDEN_VERSE_AUDIO_SUBDIR = "golden-verses";
export const GOLDEN_VERSE_AUDIO_SUFFIX = "-32kbps.mp3";

function buildGoldenVerseAudioFilename(verseKey: string): string | null {
  const loc = parseVerseKey(verseKey);
  if (!loc) return null;
  return `${loc.bookId}-${loc.chapter}-${loc.verse}${GOLDEN_VERSE_AUDIO_SUFFIX}`;
}

export function buildGoldenVerseAudioRelativePath(verseKey: string): string | null {
  const filename = buildGoldenVerseAudioFilename(verseKey);
  if (!filename) return null;
  return `${GOLDEN_VERSE_AUDIO_SUBDIR}/${filename}`;
}

export function buildGoldenVerseAudioSrc(verseKey: string): string | null {
  const relativePath = buildGoldenVerseAudioRelativePath(verseKey);
  if (!relativePath) return null;
  return `/audio/${relativePath}`;
}
