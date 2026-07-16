"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { NatureHomeSettingsSelect } from "@/components/nature/NatureHomeSettingsSelect";
import type { GoldenVerseAudioTranslationId } from "@/lib/bible/golden-verse-audio";
import {
  HOME_GOLDEN_VERSE_AUDIO_PREFS_EVENT,
  readHomeGoldenVerseAudioTranslationId,
  writeHomeGoldenVerseAudioTranslationId,
} from "@/lib/home/home-golden-verse-audio-prefs";

type Props = { onPrefsChanged?: () => void };

export function NatureHomeGoldenVerseAudioSettings({ onPrefsChanged }: Props) {
  const { locale } = useLocale();
  const [value, setValue] = useState<GoldenVerseAudioTranslationId>("cuv-simp");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setValue(readHomeGoldenVerseAudioTranslationId());
    refresh();
    window.addEventListener(HOME_GOLDEN_VERSE_AUDIO_PREFS_EVENT, refresh);
    return () => window.removeEventListener(HOME_GOLDEN_VERSE_AUDIO_PREFS_EVENT, refresh);
  }, []);

  const zh = locale !== "en";
  const options = [
    {
      id: "cuv-simp",
      label: zh ? "中文和合本（简体）" : "Chinese Union Version (Simplified)",
      shortLabel: zh ? "和合本" : "CUV",
    },
    {
      id: "web-en",
      label: zh ? "WEBP 英译本" : "World English Bible (WEBP)",
      shortLabel: "WEBP",
    },
  ];

  return (
    <NatureHomeSettingsSelect
      accessibilityLabel={zh ? "金句朗读版本" : "Verse audio translation"}
      value={value}
      options={options}
      open={open}
      onOpenChange={setOpen}
      onSelect={(id) => {
        const next = id === "web-en" ? "web-en" : "cuv-simp";
        setOpen(false);
        setValue(next);
        writeHomeGoldenVerseAudioTranslationId(next);
        onPrefsChanged?.();
      }}
    />
  );
}
