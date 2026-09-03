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
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import { ReadBibleTranslationPickerOverlay } from "@/components/bible/ReadBibleTranslationPickerOverlay";
import { readTranslationsHref } from "@/lib/read/read-translations-route";

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

function IconGear(props: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={props.size} height={props.size} className={props.className} aria-hidden>
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

type SettingsMenu = "primary" | "contrast" | "audioVoice" | null;

const layoutBtnClass = "read-parchment-chip-btn px-2 text-[13px]";

type Props = {
  buttonSize?: number;
  iconSize?: number;
};

/** 圣经 /read 系路由顶栏右上：译本、对照、字号。 */
export function ReadBibleTypographySettingsControl({ buttonSize = 44, iconSize = 15 }: Props = {}) {
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
    chapterAudioTranslationId,
  } = useReadBibleTranslationSettings();
  const [open, setOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<SettingsMenu>(null);
  const [translationPickerMode, setTranslationPickerMode] = useState<"primary" | "contrast" | null>(null);
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
        language: tr.language,
      })),
    [translationCatalog, locale],
  );

  const primaryDisplay =
    primaryOptions.find((o) => o.id === translation.primaryTranslationId)?.label ?? "";

  const contrastOptions = useMemo(
    () =>
      translationCatalog
        .filter((tr) => tr.id !== translation.primaryTranslationId)
        .map((tr) => ({
          id: tr.id,
          label: translationOptionLabel(tr, locale),
          language: tr.language,
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

  const iconBtn = `${HIT} text-white transition active:scale-[0.97] [filter:drop-shadow(0_1px_6px_rgba(0,0,0,0.55))_drop-shadow(0_0_1px_rgba(0,0,0,0.8))]`;
  return (
    <>
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("pages.read.typography.ariaOpen")}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? titleId : undefined}
        className={iconBtn}
        style={{ width: buttonSize, height: buttonSize }}
      >
        <IconGear className="opacity-100" size={iconSize} />
      </button>
      {open ? (
        <div
          id={titleId}
          role="dialog"
          aria-label={t("pages.read.typography.dialogTitle")}
          className="read-bible-settings-sheet parchment-control-sheet absolute right-0 top-[calc(100%-0.25rem)] z-[60] max-h-[min(34rem,72vh)] overflow-y-auto overscroll-y-contain text-left text-amber-950 [-webkit-overflow-scrolling:touch] dark:text-stone-50"
        >
          {showTranslation ? (
            <div className="read-bible-settings-row">
              <ShellMaterialIcon name="menu_book" size={18} color="#6e5240" />
              <div className="min-w-0 flex-1 space-y-2">
                <ReadBibleSettingsSelect
                  value={translation.primaryTranslationId}
                  options={primaryOptions}
                  open={false}
                  onOpenChange={(next) => {
                    if (!next) return;
                    setOpen(false);
                    router.push(readTranslationsHref());
                  }}
                  disabled={!translationCatalogReady || primaryOptions.length === 0}
                  ariaLabel={`${t("pages.read.typography.primaryTranslation")} ${primaryDisplay}`}
                  onSelect={(id) => {
                    if (id === translation.primaryTranslationId) return;
                    setPrimaryTranslationId(id);
                    refreshChapterIfNeeded();
                  }}
                />
                <ReadBibleSettingsSelect
                  values={contrastTranslationIds}
                  options={contrastOptions}
                  open={false}
                  onOpenChange={(next) => {
                    if (next) setTranslationPickerMode("contrast");
                  }}
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
              </div>
              {contrastTranslationIds.length > 0 ? (
                <p className="mt-1.5 text-[11px] leading-snug text-amber-900/55 dark:text-stone-400">
                  {t("pages.read.typography.contrastHint")}
                </p>
              ) : null}
            </div>
          ) : null}

          {showTranslation ? (
            <div className="read-bible-settings-row read-bible-settings-audio-row">
              <ShellMaterialIcon name="record_voice_over" size={18} color="#6e5240" />
              <div className="min-w-0 flex-1">
                <ReadChapterAudioVoiceSettingsFields
                  open={openMenu === "audioVoice"}
                  onOpenChange={(next) => setOpenMenu(next ? "audioVoice" : null)}
                />
              </div>
            </div>
          ) : null}

          <div className="read-bible-settings-row">
            <ShellMaterialIcon name="format_size" size={18} color="#6e5240" />
            <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5">
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
                <ShellMaterialIcon name="subject" size={17} color="currentColor" />
              </button>
              <button
                type="button"
                disabled={sizeAtDefault}
                aria-label={t("pages.read.typography.sizeResetDefaultAria")}
                className={`${sizeBtnClass} min-w-[3.25rem] px-2 text-[13px]`}
                onClick={resetSizeToDefault}
              >
                <ShellMaterialIcon name="text_fields" size={17} color="currentColor" />
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
                −
              </button>
              <button
                type="button"
                disabled={sizeAtMax}
                aria-label={t("pages.read.typography.sizeLargerAria")}
                className={sizeBtnClass}
                onClick={() => bumpSize(1)}
              >
                +
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    <ReadBibleTranslationPickerOverlay
      open={translationPickerMode === "contrast"}
      mode={translationPickerMode ?? "contrast"}
      title={t("pages.read.typography.contrastTranslation")}
      options={contrastOptions}
      primaryValue={translation.primaryTranslationId}
      contrastValues={contrastTranslationIds}
      noneLabel={t("pages.read.typography.contrastNone")}
      confirmLabel={locale === "en" ? "Confirm" : locale === "zh-TW" ? "確認" : "确认"}
      onClose={() => setTranslationPickerMode(null)}
      onSelectPrimary={() => setTranslationPickerMode(null)}
      onConfirmContrast={(ids) => {
        setContrastTranslationIds(ids);
        refreshChapterIfNeeded();
      }}
    />
    </>
  );
}
