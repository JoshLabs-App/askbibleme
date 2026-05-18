"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ReadChapterAudioVoiceSettingsFields } from "@/components/bible/ReadChapterAudioVoiceSettingsFields";
import {
  useReadBibleTranslationSettings,
  useReadBibleTypography,
} from "@/components/bible/ReadBibleTypographyProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
const HIT =
  "flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition active:scale-[0.97]";

function IconGear(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const selectClass =
  "mt-1.5 w-full rounded-lg border border-amber-900/18 bg-white/90 px-2.5 py-2 text-[15px] text-amber-950 outline-none focus:border-amber-900/35 dark:border-stone-500/35 dark:bg-stone-950/80 dark:text-stone-100";

const sizeBtnClass =
  "inline-flex min-h-[40px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-amber-900/18 bg-white/80 text-[17px] font-semibold leading-none tracking-tight text-amber-950 transition hover:bg-white active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35 dark:border-stone-500/35 dark:bg-stone-950/70 dark:text-stone-100 dark:hover:bg-stone-900";

/** 圣经 /read 系路由顶栏右上：译本、对照、字号。 */
export function ReadBibleTypographySettingsControl() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { sizeAtMin, sizeAtMax, bumpSize } = useReadBibleTypography();
  const {
    translation,
    translationCatalog,
    translationCatalogReady,
    setPrimaryTranslationId,
    setContrastTranslationId,
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

  const iconBtn = `${HIT} text-ink/85 hover:bg-ink/[0.06]`;

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
        <IconGear className="h-[15px] w-[15px] opacity-88" />
      </button>
      {open ? (
        <div
          id={titleId}
          role="dialog"
          aria-label={t("pages.read.typography.dialogTitle")}
          className="absolute right-0 top-[calc(100%+0.35rem)] z-[60] w-[min(20rem,calc(100vw-1.25rem))] rounded-xl border border-amber-900/14 bg-[#fffaf4]/96 px-3.5 py-3 text-left text-amber-950 shadow-lg backdrop-blur-sm dark:border-stone-500/25 dark:bg-stone-900/95 dark:text-stone-50"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900/65 dark:text-stone-400">
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
                    {locale === "zh-CN" ? tr.labelZh : tr.labelEn}
                  </option>
                ))}
              </select>

              <label
                className="mt-3 block text-[13px] font-medium text-amber-950/90 dark:text-stone-200"
                htmlFor="read-bible-contrast-translation"
              >
                {t("pages.read.typography.contrastTranslation")}
              </label>
              <select
                id="read-bible-contrast-translation"
                className={selectClass}
                disabled={!translationCatalogReady}
                value={translation.contrastTranslationId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setContrastTranslationId(v ? v : null);
                  refreshChapterIfNeeded();
                }}
              >
                <option value="">{t("pages.read.typography.contrastNone")}</option>
                {translationCatalog
                  .filter((tr) => tr.id !== translation.primaryTranslationId)
                  .map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {locale === "zh-CN" ? tr.labelZh : tr.labelEn}
                    </option>
                  ))}
              </select>
              {translation.contrastTranslationId ? (
                <p className="mt-2 text-[11px] leading-snug text-amber-900/55 dark:text-stone-400">
                  {t("pages.read.typography.contrastHint")}
                </p>
              ) : null}
            </>
          ) : null}

          {showTranslation ? <ReadChapterAudioVoiceSettingsFields /> : null}

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-amber-950/90 dark:text-stone-200">
              {t("pages.read.typography.sizeLabel")}
            </span>
            <div className="flex items-center gap-1.5">
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
