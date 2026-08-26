import { parseVerseKey } from "@/lib/bible/parse-verse-key";
import { GOLDEN_VERSE_AUDIO_SUFFIX } from "@/lib/bible/golden-verse-audio";

/** 从金句 mp3 URI 反解 verseKey（如 GEN:1:1），供原生链式接播后对齐 UI。 */
export function parseGoldenVerseKeyFromAudioUri(uri: string | null | undefined): string | null {
  const raw = (uri ?? "").trim();
  if (!raw) return null;
  const file = raw.split("/").pop()?.split("?")[0] ?? "";
  if (!file.endsWith(GOLDEN_VERSE_AUDIO_SUFFIX)) return null;
  const stem = file.slice(0, -GOLDEN_VERSE_AUDIO_SUFFIX.length);
  const parts = stem.split("-");
  if (parts.length < 3) return null;
  const verse = parts.pop();
  const chapter = parts.pop();
  const bookId = parts.join("-");
  if (!bookId || !chapter || !verse) return null;
  const key = `${bookId}:${chapter}:${verse}`.toUpperCase();
  return parseVerseKey(key) ? key : null;
}
