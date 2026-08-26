import { translationSupportsChapterAudio } from "../bible/read-chapter-audio";
import type { BibleTranslationsIndex } from "../bible/translations-types";
import type { ReadBibleTranslationPrefsV1 } from "./read-bible-translation-prefs";

/** 设置项：朗读译本与屏幕主译本相同 */
export const READ_BIBLE_AUDIO_TRANSLATION_FOLLOW_PRIMARY = "";

export function resolveChapterAudioTranslationId(
  prefs: Pick<ReadBibleTranslationPrefsV1, "primaryTranslationId" | "audioTranslationId">,
  index?: BibleTranslationsIndex,
): string {
  const primary = prefs.primaryTranslationId?.trim();
  void index;
  // 朗读必须跟随屏幕主译本；旧偏好里即使保存过其它朗读译本，也不能串读。
  return primary || "cuv-simp";
}

export function normalizeReadBibleAudioTranslationId(
  raw: unknown,
  index: BibleTranslationsIndex,
  primaryId: string,
): string | null {
  const allowed = new Set(index.translations.map((t) => t.id));
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || s === primaryId) return null;
  if (!allowed.has(s) || !translationSupportsChapterAudio(s)) return null;
  return s;
}

export function translationCatalogWithChapterAudio(
  index: BibleTranslationsIndex,
): BibleTranslationsIndex["translations"] {
  return index.translations.filter((t) => translationSupportsChapterAudio(t.id));
}
