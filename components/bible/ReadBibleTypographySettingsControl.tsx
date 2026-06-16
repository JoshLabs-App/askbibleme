"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ReadChapterAudioVoiceSettingsFields } from "@/components/bible/ReadChapterAudioVoiceSettingsFields";
import { ReadBibleSettingsSelect } from "@/components/bible/ReadBibleSettingsSelect";
import {
  useReadBibleTranslationSettings,
  useReadBibleTypography,
} from "@/components/bible/ReadBibleTypographyProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { translationSupportsChapterAudio } from "@/lib/bible/read-chapter-audio";
import {
  READ_BIBLE_AUDIO_TRANSLATION_FOLLOW_PRIMARY,
  translationCatalogWithChapterAudio,
} from "@/lib/read/read-chapter-audio-translation";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

function translationOptionLabel(
  tr: { labelZh: string; labelEn: string },
  locale: AppLocale,
): string {
  if (locale === "en") return tr.labelEn;
  if (locale === "zh-TW") return toZhTwText(tr.labelZh);
  return tr.labelZh;
}
const HIT =
  "flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition active:scale-[0.97]";

function IconGear(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const sizeBtnClass = "read-parchment-chip-btn";

type SettingsMenu = "primary" | "contrast" | "audioTranslation" | "audioVoice" | null;

const layoutBtnClass = "read-parchment-chip-btn px-2 text-[13px]";

/** 圣经 /read 系路由顶栏右上：译本、对照、字号。 */
export function ReadBibleTypographySettingsControl() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { sizeAtMin, sizeAtMax, sizeAtDefault, sizeAtLargePreset, bumpSize, resetSizeToDefault, setSizeToLargePreset, typography, setVerseParagraphFlow, setChapterSegmentMode } =
    useReadBibleTypography();
  const {
    translation,
    translationCatalog,
    translationCatalogReady,
    setPrimaryTranslationId,
    setContrastTranslationIds,
    contrastTranslationIds,
    setAudioTranslationId,
    chapterAudioTranslationId,
  } = useReadBibleTranslationSettings();
  const [open, setOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<SettingsMenu>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const showTranslation = pathname?.startsWith("/read") ?? false;
  const onChapterRoute = /^\/read\/[^/]+\/\d+\/?$/.test(pathname ?? "");

  useEffect(() => {
    if (!open) setOpenMenu(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const refreshChapterIfNeeded = () => {
    if (onChapterRoute) router.refresh();
  };

  const primaryOptions = useMemo(
    () =>
      translationCatalog.map((tr) => ({
        id: tr.id,
        label: translationOptionLabel(tr, locale),
      })),
    [translationCatalog, locale],
  );

  const primaryDisplay =
    primaryOptions.find((o) => o.id === translation.primaryTranslationId)?.label ?? "";

  const audioTranslationOptions = useMemo(() => {
    const index = { translations: translationCatalog, defaultTranslationId: null };
    const audioCatalog = translationCatalogWithChapterAudio(index);
    if (audioCatalog.length === 0) return [];
    return [
      { id: READ_BIBLE_AUDIO_TRANSLATION_FOLLOW_PRIMARY, label: t("pages.read.typography.audioTranslationFollowPrimary") },
      ...audioCatalog.map((tr) => ({
        id: tr.id,
        label: translationOptionLabel(tr, locale),
      })),
    ];
  }, [translationCatalog, locale, t]);

  const audioTranslationValue =
    translation.audioTranslationId ?? READ_BIBLE_AUDIO_TRANSLATION_FOLLOW_PRIMARY;

  const audioTranslationDisplay =
    audioTranslationOptions.find((o) => o.id === audioTranslationValue)?.label ?? "";

  const contrastOptions = useMemo(
    () =>
      translationCatalog
        .filter((tr) => tr.id !== translation.primaryTranslationId)
        .map((tr) => ({
          id: tr.id,
          label: translationOptionLabel(tr, locale),
        })),
    [translationCatalog, translation.primaryTranslationId, locale],
  );

  const contrastDisplay =
    contrastTranslationIds.length > 0
      ? contrastTranslationIds
          .map((id) => contrastOptions.find((o) => o.id === id)?.label ?? "")
          .filter(Boolean)
          .join(", ")
      : t("pages.read.typography.contrastNone");

  const iconBtn = `${HIT} text-white transition active:scale-[0.97] [filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.28))_drop-shadow(0_0_2px_rgba(0,0,0,0.1))]`;
  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("pages.read.typography.ariaOpen")}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? titleId : undefined}
        className={iconBtn}
      >
        <IconGear className="h-[15px] w-[15px] opacity-100" />
      </button>
      {open ? (
        <div
          id={titleId}
          role="dialog"
          aria-label={t("pages.read.typography.dialogTitle")}
          className="read-bible-settings-sheet parchment-control-sheet absolute right-0 top-[calc(100%+0.4rem)] z-[60] max-h-[min(34rem,72vh)] overflow-y-auto overscroll-y-contain text-left text-amber-950 [-webkit-overflow-scrolling:touch] dark:text-stone-50"
        >
          {showTranslation ? (
            <>
              <p className="read-bible-settings-field-label">
                {t("pages.read.typography.primaryTranslation")}
              </p>
              <ReadBibleSettingsSelect
                value={translation.primaryTranslationId}
                options={primaryOptions}
                open={openMenu === "primary"}
                onOpenChange={(next) => setOpenMenu(next ? "primary" : null)}
                disabled={!translationCatalogReady || primaryOptions.length === 0}
                ariaLabel={`${t("pages.read.typography.primaryTranslation")} ${primaryDisplay}`}
                onSelect={(id) => {
                  if (id === translation.primaryTranslationId) return;
                  setPrimaryTranslationId(id);
                  refreshChapterIfNeeded();
                }}
              />

              <p className="read-bible-settings-field-label">
                {t("pages.read.typography.contrastTranslation")}
              </p>
              <ReadBibleSettingsSelect
                values={contrastTranslationIds}
                options={contrastOptions}
                open={openMenu === "contrast"}
                onOpenChange={(next) => setOpenMenu(next ? "contrast" : null)}
                emptyDisplay={t("pages.read.typography.contrastNone")}
                disabled={!translationCatalogReady || contrastOptions.length === 0}
                ariaLabel={`${t("pages.read.typography.contrastTranslation")} ${contrastDisplay}`}
                onToggleSelect={(id) => {
                  const checked = contrastTranslationIds.includes(id);
                  const next = checked
                    ? contrastTranslationIds.filter((item) => item !== id)
                    : [...contrastTranslationIds, id];
                  setContrastTranslationIds(next);
                  refreshChapterIfNeeded();
                }}
              />
              {contrastTranslationIds.length > 0 ? (
                <p className="mt-1.5 text-[11px] leading-snug text-amber-900/55 dark:text-stone-400">
                  {t("pages.read.typography.contrastHint")}
                </p>
              ) : null}

              {audioTranslationOptions.length > 1 ? (
                <>
                  <p className="read-bible-settings-field-label">
                    {t("pages.read.typography.audioTranslation")}
                  </p>
                  <ReadBibleSettingsSelect
                    value={audioTranslationValue}
                    options={audioTranslationOptions}
                    open={openMenu === "audioTranslation"}
                    onOpenChange={(next) => setOpenMenu(next ? "audioTranslation" : null)}
                    disabled={!translationCatalogReady}
                    ariaLabel={`${t("pages.read.typography.audioTranslation")} ${audioTranslationDisplay}`}
                    onSelect={(id) => {
                      if (id === audioTranslationValue) return;
                      setAudioTranslationId(
                        !id || id === READ_BIBLE_AUDIO_TRANSLATION_FOLLOW_PRIMARY ? null : id,
                      );
                      refreshChapterIfNeeded();
                    }}
                  />
                </>
              ) : null}
              {translation.audioTranslationId &&
              translation.audioTranslationId !== translation.primaryTranslationId &&
              translationSupportsChapterAudio(translation.audioTranslationId) ? (
                <p className="mt-2 text-[11px] leading-snug text-amber-900/55 dark:text-stone-400">
                  {t("pages.read.typography.audioTranslationCrossHint")}
                </p>
              ) : null}
            </>
          ) : null}

          {showTranslation ? (
            <ReadChapterAudioVoiceSettingsFields
              open={openMenu === "audioVoice"}
              onOpenChange={(next) => setOpenMenu(next ? "audioVoice" : null)}
            />
          ) : null}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="read-bible-settings-field-label mt-0">
              {t("pages.read.typography.sizeLabel")}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                role="switch"
                aria-checked={typography.verseParagraphFlow}
                aria-label={t("pages.read.typography.verseParagraphFlowLabel")}
                title={t("pages.read.typography.verseParagraphFlowLabel")}
                className={[
                  layoutBtnClass,
                  typography.verseParagraphFlow ? "read-parchment-chip-btn--active" : "",
                ].join(" ")}
                onClick={() => setVerseParagraphFlow(!typography.verseParagraphFlow)}
              >
                ¶
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={typography.chapterSegmentMode === "t1"}
                aria-label={t("pages.read.typography.chapterSegmentModeT1Aria")}
                title={t("pages.read.typography.chapterSegmentModeT1Aria")}
                className={[
                  layoutBtnClass,
                  typography.chapterSegmentMode === "t1" ? "read-parchment-chip-btn--active" : "",
                ].join(" ")}
                onClick={() =>
                  setChapterSegmentMode(typography.chapterSegmentMode === "t1" ? "default" : "t1")
                }
              >
                T1
              </button>
              <button
                type="button"
                disabled={sizeAtDefault}
                aria-label={t("pages.read.typography.sizeResetDefaultAria")}
                className={`${sizeBtnClass} min-w-[3.25rem] px-2 text-[13px]`}
                onClick={resetSizeToDefault}
              >
                {t("pages.read.typography.sizeResetDefault")}
              </button>
              <button
                type="button"
                disabled={sizeAtLargePreset}
                aria-label={t("pages.read.typography.sizeLargePresetAria")}
                className={`${sizeBtnClass} min-w-[2.75rem] px-2 text-[15px] tracking-tight`}
                onClick={setSizeToLargePreset}
              >
                TT
              </button>
              <button
                type="button"
                disabled={sizeAtMin}
                aria-label={t("pages.read.typography.sizeSmallerAria")}
                className={sizeBtnClass}
                onClick={() => bumpSize(-1)}
              >
                A<span className="relative -top-[0.35em] text-[11px] font-bold">−</span>
              </button>
              <button
                type="button"
                disabled={sizeAtMax}
                aria-label={t("pages.read.typography.sizeLargerAria")}
                className={sizeBtnClass}
                onClick={() => bumpSize(1)}
              >
                A<span className="relative -top-[0.35em] text-[11px] font-bold">+</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
