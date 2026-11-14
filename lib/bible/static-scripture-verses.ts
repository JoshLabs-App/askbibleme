import { loadedChapterVerseFromRow, type LoadedChapterVerse } from "@/lib/bible/loaded-chapter-verse";
import type { StaticScriptureVerse } from "@/lib/bible/static-scripture-shape";

/**
 * 静态经文条目 → 读经页的节。纯函数，服务端加载器与网页客户端读经页共用。
 * 条目为纯字符串时没有朗读分色与金句标注（见 static-scripture-shape.ts）。
 */
export function staticScriptureEntryToLoadedVerse(
  entry: StaticScriptureVerse,
  index: number,
): LoadedChapterVerse | null {
  const row =
    typeof entry === "string"
      ? { verse: index + 1, text: entry }
      : {
          verse: index + 1,
          text: entry.t,
          speech_spans: entry.s ?? null,
          theme_repeat_count: entry.r ?? 0,
        };
  return loadedChapterVerseFromRow(row);
}

export function staticScriptureEntriesToLoadedVerses(
  entries: readonly (StaticScriptureVerse | null | undefined)[],
): LoadedChapterVerse[] {
  const verses: LoadedChapterVerse[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry === undefined || entry === null) continue;
    const v = staticScriptureEntryToLoadedVerse(entry, i);
    if (v) verses.push(v);
  }
  return verses;
}
