"use client";

import { useCuvChapterAudioVoice } from "@/components/bible/CuvChapterAudioVoiceContext";
import { useReadBibleTranslationSettings } from "@/components/bible/ReadBibleTypographyProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { translationSupportsChapterAudio } from "@/lib/bible/read-chapter-audio";
import { translationUsesWebChapterAudio } from "@/lib/bible/web-chapter-audio";
import {
  CUV_CHAPTER_AUDIO_VOICES,
  type CuvChapterAudioVoiceId,
} from "@/lib/bible/cuv-chapter-audio-voices";
import { isCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";

const selectClass =
  "mt-1.5 w-full rounded-lg border border-amber-900/18 bg-white/90 px-2.5 py-2 text-[15px] text-amber-950 outline-none focus:border-amber-900/35 dark:border-stone-500/35 dark:bg-stone-950/80 dark:text-stone-100";

/** 阅读设置弹层：整章朗读人声（普通话 / 潮州语新约）。 */
export function ReadChapterAudioVoiceSettingsFields() {
  const { t } = useLocale();
  const { voiceId, setVoiceId } = useCuvChapterAudioVoice();
  const { translation, chapterAudioTranslationId } = useReadBibleTranslationSettings();
  const { playing, effectiveSrc, pausePlayback } = useMusicShellPlayback();

  const primarySupportsAudio = translationSupportsChapterAudio(chapterAudioTranslationId);
  const webAudioOnly = translationUsesWebChapterAudio(chapterAudioTranslationId);

  const onChange = (next: string) => {
    const id = next as CuvChapterAudioVoiceId;
    if (id === voiceId) return;
    setVoiceId(id);
    if (playing && isCuvChapterAudioEffectiveSrc(effectiveSrc)) {
      pausePlayback();
    }
  };

  return (
    <>
      {!webAudioOnly ? (
        <>
          <label
            className="mt-3 block text-[13px] font-medium text-amber-950/90 dark:text-stone-200"
            htmlFor="read-bible-chapter-audio-voice"
          >
            {t("pages.read.typography.chapterAudioVoiceLabel")}
          </label>
          <select
            id="read-bible-chapter-audio-voice"
            className={selectClass}
            value={voiceId}
            onChange={(e) => onChange(e.target.value)}
          >
            {CUV_CHAPTER_AUDIO_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {t(v.labelKey)}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <p className="mt-2 text-[11px] leading-snug text-amber-900/55 dark:text-stone-400">
        {webAudioOnly
          ? t("pages.read.typography.chapterAudioVoiceHintWebEn")
          : primarySupportsAudio
            ? t("pages.read.typography.chapterAudioVoiceHint")
            : t("pages.read.typography.chapterAudioVoiceHintNonCuv")}
      </p>
    </>
  );
}
