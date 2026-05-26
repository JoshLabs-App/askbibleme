import { translationSupportsChapterAudio } from "@/lib/bible/read-chapter-audio";
import type { BibleTranslationsIndex } from "@/lib/bible/translations-types";
import type { ReadBibleTranslationPrefsV1 } from "@/lib/read/read-bible-translation-prefs";

/** 设置项：朗读译本与屏幕主译本相同 */
export const READ_BIBLE_AUDIO_TRANSLATION_FOLLOW_PRIMARY = "";

export function resolveChapterAudioTranslationId(
  prefs: Pick<ReadBibleTranslationPrefsV1, "primaryTranslationId" | "audioTranslationId">,
): string {
  const id = prefs.audioTranslationId?.trim();
  if (id) return id;
  return prefs.primaryTranslationId;
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
