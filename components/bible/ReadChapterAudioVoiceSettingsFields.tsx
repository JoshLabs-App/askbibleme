"use client";

import { useMemo } from "react";
import { ReadBibleSettingsSelect } from "@/components/bible/ReadBibleSettingsSelect";
import { useCuvChapterAudioVoice } from "@/components/bible/CuvChapterAudioVoiceContext";
import { useReadBibleTranslationSettings } from "@/components/bible/ReadBibleTypographyProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { translationSupportsChapterAudio } from "@/lib/bible/read-chapter-audio";
import {
  translationUsesKjvChapterAudio,
  translationUsesWebChapterAudio,
} from "@/lib/bible/web-chapter-audio";
import {
  CUV_CHAPTER_AUDIO_VOICES,
  type CuvChapterAudioVoiceId,
} from "@/lib/bible/cuv-chapter-audio-voices";
import { isCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** 阅读设置弹层：整章朗读人声（普通话 / 潮州语新约）。 */
export function ReadChapterAudioVoiceSettingsFields({ open, onOpenChange }: Props) {
  const { t } = useLocale();
  const { voiceId, setVoiceId } = useCuvChapterAudioVoice();
  const { chapterAudioTranslationId } = useReadBibleTranslationSettings();
  const { playing, effectiveSrc, pausePlayback } = useMusicShellPlayback();

  const primarySupportsAudio = translationSupportsChapterAudio(chapterAudioTranslationId);
  const webAudioOnly = translationUsesWebChapterAudio(chapterAudioTranslationId);
  const kjvAudioOnly = translationUsesKjvChapterAudio(chapterAudioTranslationId);

  const voiceOptions = useMemo(
    () =>
      CUV_CHAPTER_AUDIO_VOICES.map((v) => ({
        id: v.id,
        label: t(v.labelKey),
      })),
    [t],
  );

  const voiceDisplay = voiceOptions.find((o) => o.id === voiceId)?.label ?? "";

  const onSelectVoice = (next: string) => {
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
          <p className="read-bible-settings-field-label">
            {t("pages.read.typography.chapterAudioVoiceLabel")}
          </p>
          <ReadBibleSettingsSelect
            value={voiceId}
            options={voiceOptions}
            open={open}
            onOpenChange={onOpenChange}
            ariaLabel={`${t("pages.read.typography.chapterAudioVoiceLabel")} ${voiceDisplay}`}
            onSelect={onSelectVoice}
          />
        </>
      ) : null}
      <p className="mt-2 text-[11px] leading-snug text-amber-900/55 dark:text-stone-400">
        {webAudioOnly
          ? t(
              kjvAudioOnly
                ? "pages.read.typography.chapterAudioVoiceHintKjv"
                : "pages.read.typography.chapterAudioVoiceHintWebEn",
            )
          : primarySupportsAudio
            ? t("pages.read.typography.chapterAudioVoiceHint")
            : t("pages.read.typography.chapterAudioVoiceHintNonCuv")}
      </p>
    </>
  );
}
