"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ReadChapterAudioVoiceSettingsFields } from "@/components/bible/ReadChapterAudioVoiceSettingsFields";
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

const selectClass =
  "mt-1.5 w-full rounded-[0.9rem] border border-amber-900/14 bg-[#fffdf8] px-2.75 py-2.25 text-[15px] text-amber-950 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] focus:border-amber-900/30 dark:border-stone-500/30 dark:bg-stone-950/90 dark:text-stone-100";

const sizeBtnClass =
  "inline-flex min-h-[40px] min-w-[44px] shrink-0 items-center justify-center rounded-[0.8rem] border border-amber-900/14 bg-[#fffdf8] text-[17px] font-semibold leading-none tracking-tight text-amber-950 transition hover:bg-[#fffefb] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35 dark:border-stone-500/30 dark:bg-stone-950/90 dark:text-stone-100 dark:hover:bg-stone-900";

const layoutBtnClass =
  "inline-flex min-h-[40px] min-w-[44px] shrink-0 items-center justify-center rounded-[0.8rem] border border-amber-900/14 bg-[#fffdf8] px-2 text-[13px] font-semibold leading-none text-amber-950 transition hover:bg-[#fffefb] active:scale-[0.97] dark:border-stone-500/30 dark:bg-stone-950/90 dark:text-stone-100 dark:hover:bg-stone-900";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const showTranslation = pathname?.startsWith("/read") ?? false;
  const onChapterRoute = /^\/read\/[^/]+\/\d+\/?$/.test(pathname ?? "");

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

  const iconBtn = `${HIT} text-white transition active:scale-[0.97] [filter:drop-shadow(0_1px_1px_rgba(0,0,0,0.28))_drop-shadow(0_0_2px_rgba(0,0,0,0.1))]`;
  const panelTitleClass = "text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900/65 dark:text-stone-400";

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
          className="absolute right-0 top-[calc(100%+0.4rem)] z-[60] w-[min(20rem,calc(100vw-1.25rem))] max-h-[min(34rem,72vh)] overflow-y-auto overscroll-y-contain rounded-[1.05rem] border border-amber-900/14 bg-[#fbf5ea] px-3.5 pt-3.5 pb-4 text-left text-amber-950 shadow-[0_18px_42px_rgba(26,18,8,0.18)] backdrop-blur-sm [-webkit-overflow-scrolling:touch] dark:border-stone-500/25 dark:bg-stone-900/97 dark:text-stone-50"
        >
          <p className={panelTitleClass}>
            {t("pages.read.typography.dialogTitle")}
          </p>

          {showTranslation ? (
            <>
              <label
                className="mt-3 block text-[13px] font-medium text-amber-950/90 dark:text-stone-200"
                htmlFor="read-bible-primary-translation"
              >
                {t("pages.read.typography.primaryTranslation")}
              </label>
              <select
                id="read-bible-primary-translation"
                className={selectClass}
                disabled={!translationCatalogReady}
                value={translation.primaryTranslationId}
                onChange={(e) => {
                  setPrimaryTranslationId(e.target.value);
                  refreshChapterIfNeeded();
                }}
              >
                {translationCatalog.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {translationOptionLabel(tr, locale)}
                  </option>
                ))}
              </select>

              <p className="mt-3 text-[13px] font-medium text-amber-950/90 dark:text-stone-200">
                {t("pages.read.typography.contrastTranslation")}
              </p>
              <ul className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-[0.9rem] border border-amber-900/14 bg-[#fffdf8] p-2 dark:border-stone-500/30 dark:bg-stone-950/90">
                {translationCatalog
                  .filter((tr) => tr.id !== translation.primaryTranslationId)
                  .map((tr) => {
                    const checked = contrastTranslationIds.includes(tr.id);
                    return (
                      <li key={tr.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-[0.65rem] px-1.75 py-1.75 text-[14px] text-amber-950 hover:bg-amber-950/[0.04] dark:text-stone-100 dark:hover:bg-white/[0.06]">
                          <input
                            type="checkbox"
                            className="h-4 w-4 shrink-0 accent-amber-800"
                            disabled={!translationCatalogReady}
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? contrastTranslationIds.filter((id) => id !== tr.id)
                                : [...contrastTranslationIds, tr.id];
                              setContrastTranslationIds(next);
                              refreshChapterIfNeeded();
                            }}
                          />
                          <span>{translationOptionLabel(tr, locale)}</span>
                        </label>
                      </li>
                    );
                  })}
              </ul>
              {contrastTranslationIds.length === 0 ? (
                <p className="mt-1.5 text-[12px] text-amber-900/55 dark:text-stone-400">
                  {t("pages.read.typography.contrastNone")}
                </p>
              ) : (
                <p className="mt-2 text-[11px] leading-snug text-amber-900/55 dark:text-stone-400">
                  {t("pages.read.typography.contrastHint")}
                </p>
              )}

              {audioTranslationOptions.length > 1 ? (
                <>
                  <label
                    className="mt-3 block text-[13px] font-medium text-amber-950/90 dark:text-stone-200"
                    htmlFor="read-bible-audio-translation"
                  >
                    {t("pages.read.typography.audioTranslation")}
                  </label>
                  <select
                    id="read-bible-audio-translation"
                    className={selectClass}
                    disabled={!translationCatalogReady}
                    value={translation.audioTranslationId ?? READ_BIBLE_AUDIO_TRANSLATION_FOLLOW_PRIMARY}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAudioTranslationId(
                        !v || v === READ_BIBLE_AUDIO_TRANSLATION_FOLLOW_PRIMARY ? null : v,
                      );
                      refreshChapterIfNeeded();
                    }}
                  >
                    {audioTranslationOptions.map((opt) => (
                      <option key={opt.id || "follow"} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
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

          {showTranslation ? <ReadChapterAudioVoiceSettingsFields /> : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-amber-950/90 dark:text-stone-200">
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
                  typography.verseParagraphFlow
                    ? "border-amber-800/35 bg-amber-950/[0.08] text-amber-900 dark:border-amber-200/25 dark:bg-amber-100/10 dark:text-amber-100"
                    : "",
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
                  typography.chapterSegmentMode === "t1"
                    ? "border-amber-800/35 bg-amber-950/[0.08] text-amber-900 dark:border-amber-200/25 dark:bg-amber-100/10 dark:text-amber-100"
                    : "",
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
