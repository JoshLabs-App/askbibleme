import { translationSupportsChapterAudio } from "@/lib/bible/read-chapter-audio";
import type { BibleTranslationsIndex } from "@/lib/bible/translations-types";
import type { ReadBibleTranslationPrefsV1 } from "@/lib/read/read-bible-translation-prefs";
import { resolveCorrespondingChapterAudioTranslationId } from "@/lib/read/resolve-corresponding-chapter-audio-translation";
import { translationUsesWebChapterAudio } from "@/lib/bible/web-chapter-audio";
import { translationHasVerifiedYouVersionChapterAudio } from "@/lib/bible/youversion-chapter-audio";

/** 设置项：朗读译本与屏幕主译本相同 */
export const READ_BIBLE_AUDIO_TRANSLATION_FOLLOW_PRIMARY = "";

export function resolveChapterAudioTranslationId(
  prefs: Pick<ReadBibleTranslationPrefsV1, "primaryTranslationId" | "audioTranslationId">,
  _index?: BibleTranslationsIndex,
): string {
  // 朗读必须与屏幕正文使用同一译本。没有对应音频时保留主译本 ID，
  // 让调用方按“不支持播放”处理，绝不借用其它译本的音轨。
  return resolveCorrespondingChapterAudioTranslationId(prefs.primaryTranslationId || "");
}

export function normalizeReadBibleAudioTranslationId(
  raw: unknown,
  index: BibleTranslationsIndex,
  primaryId: string,
): string | null {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) return null;
  const allowed = new Set(index.translations.map((t) => t.id));
  if (!allowed.has(id)) return null;
  if (translationUsesWebChapterAudio(id) || translationHasVerifiedYouVersionChapterAudio(id)) {
    return id;
  }
  void primaryId;
  return null;
}

export function translationCatalogWithChapterAudio(
  index: BibleTranslationsIndex,
): BibleTranslationsIndex["translations"] {
  return index.translations.filter((t) => translationSupportsChapterAudio(t.id));
}
