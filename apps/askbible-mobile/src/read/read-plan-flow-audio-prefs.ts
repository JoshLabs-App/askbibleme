import { bundledBibleTranslationsCatalog } from "../api/fetchBibleTranslationsCatalog";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { getLocale } from "../i18n/locale-store";
import { readReadBibleTranslationPrefs } from "./read-bible-translation-prefs";
import { resolveChapterAudioTranslationId } from "./read-chapter-audio-translation";

export type PlanFlowChapterAudioPrefs = {
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
};

/** planFlow 启动/续章：读取当前朗读译本与声线（不依赖 React context）。 */
export async function readPlanFlowChapterAudioPrefs(): Promise<PlanFlowChapterAudioPrefs> {
  const index = bundledBibleTranslationsCatalog();
  const [voiceId, translationPrefs] = await Promise.all([
    readCuvChapterAudioVoice(),
    readReadBibleTranslationPrefs(index, getLocale()),
  ]);
  return {
    translationId: resolveChapterAudioTranslationId(translationPrefs, index),
    voiceId,
  };
}
