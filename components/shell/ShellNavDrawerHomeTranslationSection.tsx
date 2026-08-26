"use client";

import { useEffect, useMemo, useState } from "react";
import { ReadBibleTranslationPickerOverlay } from "@/components/bible/ReadBibleTranslationPickerOverlay";
import { useReadBibleTranslationSettings } from "@/components/bible/ReadBibleTypographyProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import {
  HOME_GOLDEN_VERSE_AUDIO_PREFS_EVENT,
  readHomeGoldenVerseAudioTranslationId,
  writeHomeGoldenVerseAudioTranslationId,
} from "@/lib/home/home-golden-verse-audio-prefs";
import type { GoldenVerseAudioTranslationId } from "@/lib/bible/golden-verse-audio";

function translationOptionLabel(
  tr: { labelZh: string; labelEn: string },
  locale: AppLocale,
): string {
  if (locale === "en") return tr.labelEn;
  if (locale === "zh-TW") return toZhTwText(tr.labelZh);
  return tr.labelZh;
}

type SectionProps = {
  onOpenBibleVersionPicker: () => void;
};

/** 左上菜单：经文版本（与读经同步）+ 金句朗读（中文 / 英文）。 */
export function ShellNavDrawerHomeTranslationSection({ onOpenBibleVersionPicker }: SectionProps) {
  const { locale } = useLocale();
  const { translation, translationCatalog } = useReadBibleTranslationSettings();
  const [readingTranslationId, setReadingTranslationId] = useState<GoldenVerseAudioTranslationId>(() =>
    readHomeGoldenVerseAudioTranslationId(),
  );
  const zh = locale === "zh-CN" || locale === "zh-TW";

  useEffect(() => {
    const refresh = () => setReadingTranslationId(readHomeGoldenVerseAudioTranslationId());
    window.addEventListener(HOME_GOLDEN_VERSE_AUDIO_PREFS_EVENT, refresh);
    return () => window.removeEventListener(HOME_GOLDEN_VERSE_AUDIO_PREFS_EVENT, refresh);
  }, []);

  const primaryDisplay = useMemo(() => {
    const meta = translationCatalog.find((item) => item.id === translation.primaryTranslationId);
    if (!meta) return translation.primaryTranslationId;
    return translationOptionLabel(meta, locale);
  }, [locale, translation.primaryTranslationId, translationCatalog]);

  const readingChips: { id: GoldenVerseAudioTranslationId; label: string }[] = [
    { id: "cuv-simp", label: zh ? "中文" : "Chinese" },
    { id: "web-en", label: zh ? "英文" : "English" },
  ];

  return (
    <>
      <button type="button" className="shell-nav-drawer-row w-full shell-nav-drawer-row-stack" onClick={onOpenBibleVersionPicker}>
        <span className="shell-nav-drawer-row-text">{zh ? "圣经版本" : "Bible version"}</span>
        <span className="shell-nav-drawer-row-detail">{primaryDisplay} ›</span>
      </button>
      <div className="shell-nav-drawer-locale-row">
        <span className="shell-nav-drawer-row-text">{zh ? "金句朗读" : "Verse audio"}</span>
        <div className="shell-nav-drawer-locale-chips">
          {readingChips.map((item) => {
            const selected = readingTranslationId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className="shell-nav-drawer-locale-chip"
                aria-pressed={selected}
                aria-label={item.label}
                onClick={() => writeHomeGoldenVerseAudioTranslationId(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

type PickerProps = {
  open: boolean;
  onClose: () => void;
};

/** 挂在抽屉 Modal 外，避免嵌套 overlay 点不进。 */
export function ShellNavDrawerBibleVersionPicker({ open, onClose }: PickerProps) {
  const { locale, t } = useLocale();
  const { translation, translationCatalog, setPrimaryTranslationId, contrastTranslationIds } =
    useReadBibleTranslationSettings();

  const primaryOptions = useMemo(
    () =>
      translationCatalog.map((tr) => ({
        id: tr.id,
        label: translationOptionLabel(tr, locale),
        language: tr.language,
      })),
    [translationCatalog, locale],
  );

  return (
    <ReadBibleTranslationPickerOverlay
      open={open}
      mode="primary"
      title={t("pages.read.typography.primaryTranslation")}
      options={primaryOptions}
      primaryValue={translation.primaryTranslationId}
      contrastValues={contrastTranslationIds}
      noneLabel={t("pages.read.typography.contrastNone")}
      confirmLabel={locale === "en" ? "Confirm" : "确认"}
      onClose={onClose}
      onSelectPrimary={(id) => {
        onClose();
        if (id !== translation.primaryTranslationId) void setPrimaryTranslationId(id);
      }}
      onConfirmContrast={() => onClose()}
    />
  );
}
