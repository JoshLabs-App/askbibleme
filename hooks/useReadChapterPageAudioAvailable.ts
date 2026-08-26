"use client";

import { useReadBibleTranslationSettings } from "@/components/bible/ReadBibleTypographyProvider";
import { translationSupportsChapterAudio } from "@/lib/bible/read-chapter-audio";

/** 章页是否可展示经朗读坞（与 App `readChapterAudioAvailable` 简化版一致）。 */
export function useReadChapterPageAudioAvailable(): boolean {
  const { chapterAudioTranslationId } = useReadBibleTranslationSettings();
  return translationSupportsChapterAudio(chapterAudioTranslationId);
}
