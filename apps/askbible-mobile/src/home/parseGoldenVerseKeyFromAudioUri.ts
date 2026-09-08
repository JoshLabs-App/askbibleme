import { parseVerseKey } from "@/lib/bible/parse-verse-key";
import { GOLDEN_VERSE_AUDIO_SUFFIX } from "@/lib/bible/golden-verse-audio";

/**
 * 从金句 mp3 URI 反解 verseKey（如 `GEN.1.1`），供原生链式接播后对齐 UI。
 *
 * 分隔符必须是点。这里原本拼的是冒号，而 `parseVerseKey` 只认点，于是**每一次调用
 * 都返回 null**——原生接句后 JS 拿不到句 key，「这句原生已经在读了」的判断永远不成立，
 * 于是又抽一句重开，把原生刚起的这句掐掉（Josh：「每点一次音乐，金句就会重新来，
 * 甚至会断掉」）。轮播用的 key 全库都是点分（`PRO.3.5`），这里跟上。
 */
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
  const key = `${bookId}.${chapter}.${verse}`.toUpperCase();
  return parseVerseKey(key) ? key : null;
}
