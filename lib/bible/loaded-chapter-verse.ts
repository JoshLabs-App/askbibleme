import {
  speechPartsFromStoredSpans,
  verseShowsGoldenThemeMarker,
  type VerseSpeechPart,
} from "@/lib/bible/verse-annotations";

export type LoadedChapterVerse = {
  verse: number;
  text: string;
  /** 预计算说话分色；无标注且需回退时由 UI 运行时推断 */
  speechParts: VerseSpeechPart[] | null;
  /** 主题库陈列次数（未收录为 0） */
  themeRepeatCount: number;
  /** 陈列次数 ≥ `MIN_GOLDEN_THEME_REPEAT_COUNT` 时显示金句色带 */
  isGolden: boolean;
};

export function loadedChapterVerseFromRow(row: {
  verse: number;
  text: string;
  speech_spans?: string | null;
  flags?: number | null;
  theme_repeat_count?: number | null;
}): LoadedChapterVerse | null {
  const verse = Number(row.verse);
  const text = String(row.text ?? "").trim();
  if (!Number.isInteger(verse) || verse < 1 || !text) return null;
  const themeRepeatCount = Math.max(0, Number(row.theme_repeat_count ?? 0));
  return {
    verse,
    text,
    speechParts: speechPartsFromStoredSpans(text, row.speech_spans),
    themeRepeatCount,
    isGolden: verseShowsGoldenThemeMarker(themeRepeatCount),
  };
}
