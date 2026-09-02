import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { CUV_CHAPTER_AUDIO_VOICES } from "../bible/cuv-chapter-audio-voices";
import { translationSupportsCuvChapterAudio } from "../bible/cuv-chapter-audio";
import { translationUsesWebChapterAudio } from "../bible/web-chapter-audio";
import { translationHasVerifiedYouVersionChapterAudio } from "@/lib/bible/youversion-chapter-audio";
import type { AppLocale } from "../i18n/config";
import { localizeZhText } from "../i18n/site-copy";
import type { BibleTranslationMeta } from "../bible/translations-types";

export type ChapterAudioPlaybackOption = {
  id: string;
  label: string;
};

const VOICE_LABEL_KEYS: Record<CuvChapterAudioVoiceId, string> = {
  mandarin: "pages.read.chapterAudioVoiceMandarin",
  "teochew-nt": "pages.read.chapterAudioVoiceTeochewNt",
};

function translationLabel(tr: BibleTranslationMeta, locale: AppLocale): string {
  return locale === "en" ? tr.labelEn : localizeZhText(locale, tr.labelZh);
}

function isCuvVoiceOptionId(id: string): id is CuvChapterAudioVoiceId {
  return id === "mandarin" || id === "teochew-nt";
}

export function translationUsesEditionChapterAudio(translationId: string): boolean {
  return (
    translationUsesWebChapterAudio(translationId) ||
    translationHasVerifiedYouVersionChapterAudio(translationId)
  );
}

/**
 * 朗读选项 id：
 * - `mandarin` / `teochew-nt`：人声（译本跟上方「圣经版本」）
 * - 其它译本 id：跟随对应译本的整章音轨
 */
export function encodeChapterAudioPlaybackOptionId(
  audioTranslationId: string | null,
  voiceId: CuvChapterAudioVoiceId,
  primaryTranslationId: string,
): string {
  const audio = audioTranslationId?.trim();
  if (audio && translationUsesEditionChapterAudio(audio)) return audio;
  if (
    !audio &&
    translationUsesEditionChapterAudio(primaryTranslationId) &&
    translationSupportsCuvChapterAudio(primaryTranslationId) === false
  ) {
    return primaryTranslationId;
  }
  return voiceId;
}

export function decodeChapterAudioPlaybackOptionId(
  optionId: string,
): { audioTranslationId: string | null; voiceId: CuvChapterAudioVoiceId } {
  const raw = optionId.trim();
  if (translationUsesEditionChapterAudio(raw)) {
    return { audioTranslationId: raw, voiceId: "mandarin" };
  }
  if (isCuvVoiceOptionId(raw)) {
    return { audioTranslationId: null, voiceId: raw };
  }
  const colon = raw.indexOf(":");
  if (colon > 0) {
    const trPart = raw.slice(0, colon);
    const voice = raw.slice(colon + 1);
    if (translationUsesEditionChapterAudio(trPart)) {
      return { audioTranslationId: trPart, voiceId: "mandarin" };
    }
    const voiceId: CuvChapterAudioVoiceId = voice === "teochew-nt" ? "teochew-nt" : "mandarin";
    return { audioTranslationId: null, voiceId };
  }
  return { audioTranslationId: null, voiceId: "mandarin" };
}

/**
 * 圣经版本在「圣经版本」里选；此处仅列当前主版本自己的朗读音轨。
 * 朗读实际播放永远跟随屏幕主版本（见 resolveChapterAudioTranslationId），
 * 所以这里绝不能列出其它译本的音轨——那些选项即使被选中也不会真的播放。
 */
export function buildChapterAudioPlaybackOptions(
  catalog: BibleTranslationMeta[],
  locale: AppLocale,
  t: (key: string) => string,
  primaryTranslationId: string,
): ChapterAudioPlaybackOption[] {
  const out: ChapterAudioPlaybackOption[] = [];

  if (translationSupportsCuvChapterAudio(primaryTranslationId)) {
    for (const v of CUV_CHAPTER_AUDIO_VOICES) {
      out.push({ id: v.id, label: t(VOICE_LABEL_KEYS[v.id]) });
    }
    return out;
  }

  if (translationUsesEditionChapterAudio(primaryTranslationId)) {
    const tr = catalog.find((tr) => tr.id === primaryTranslationId);
    if (tr) out.push({ id: tr.id, label: translationLabel(tr, locale) });
  }

  return out;
}

export function chapterAudioPlaybackUsesWebAudio(optionId: string): boolean {
  return translationUsesWebChapterAudio(optionId.trim());
}
