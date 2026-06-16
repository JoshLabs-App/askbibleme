import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { CUV_CHAPTER_AUDIO_VOICES } from "../bible/cuv-chapter-audio-voices";
import { translationSupportsCuvChapterAudio } from "../bible/cuv-chapter-audio";
import { translationUsesWebChapterAudio } from "../bible/web-chapter-audio";
import type { AppLocale } from "../i18n/config";
import { localizeZhText } from "../i18n/site-copy";
import type { BibleTranslationMeta } from "../bible/translations-types";
import { translationCatalogWithChapterAudio } from "./read-chapter-audio-translation";

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

/**
 * 朗读选项 id：
 * - `mandarin` / `teochew-nt`：人声（译本跟上方「圣经版本」）
 * - `web-en` / `bbe-en` / `blm-es`：跟随译本的整章音轨
 */
export function encodeChapterAudioPlaybackOptionId(
  audioTranslationId: string | null,
  voiceId: CuvChapterAudioVoiceId,
  primaryTranslationId: string,
): string {
  const audio = audioTranslationId?.trim();
  if (audio && translationUsesWebChapterAudio(audio)) return audio;
  if (
    !audio &&
    translationUsesWebChapterAudio(primaryTranslationId) &&
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
  if (translationUsesWebChapterAudio(raw)) {
    return { audioTranslationId: raw, voiceId: "mandarin" };
  }
  if (isCuvVoiceOptionId(raw)) {
    return { audioTranslationId: null, voiceId: raw };
  }
  const colon = raw.indexOf(":");
  if (colon > 0) {
    const trPart = raw.slice(0, colon);
    const voice = raw.slice(colon + 1);
    if (translationUsesWebChapterAudio(trPart)) {
      return { audioTranslationId: trPart, voiceId: "mandarin" };
    }
    const voiceId: CuvChapterAudioVoiceId = voice === "teochew-nt" ? "teochew-nt" : "mandarin";
    return { audioTranslationId: null, voiceId };
  }
  return { audioTranslationId: null, voiceId: "mandarin" };
}

/** 圣经版本在「圣经版本」里选；此处仅列朗读人声与英文音轨（各出现一次） */
export function buildChapterAudioPlaybackOptions(
  catalog: BibleTranslationMeta[],
  locale: AppLocale,
  t: (key: string) => string,
): ChapterAudioPlaybackOption[] {
  const audioCatalog = translationCatalogWithChapterAudio({
    translations: catalog,
    defaultTranslationId: null,
  });
  const out: ChapterAudioPlaybackOption[] = [];
  const hasCuvAudio = audioCatalog.some((tr) => translationSupportsCuvChapterAudio(tr.id));

  if (hasCuvAudio) {
    for (const v of CUV_CHAPTER_AUDIO_VOICES) {
      out.push({ id: v.id, label: t(VOICE_LABEL_KEYS[v.id]) });
    }
  }

  for (const tr of audioCatalog) {
    if (translationUsesWebChapterAudio(tr.id)) {
      out.push({ id: tr.id, label: translationLabel(tr, locale) });
    }
  }

  return out;
}

export function chapterAudioPlaybackUsesWebAudio(optionId: string): boolean {
  return translationUsesWebChapterAudio(optionId.trim());
}
