"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useReadBibleTypography } from "@/components/bible/ReadBibleTypographyProvider";
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

/** 圣经 /read 系路由顶栏右上：字体 + 字号；偏好存 localStorage，由 `ReadBibleTypographyProvider` 写 CSS 变量。 */
export function ReadBibleTypographySettingsControl() {
  const { t } = useLocale();
  const { prefs, setFont, setSize } = useReadBibleTypography();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

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
          <label className="mt-3 block text-[13px] font-medium text-amber-950/90 dark:text-stone-200" htmlFor="read-bible-font-select">
            {t("pages.read.typography.fontLabel")}
          </label>
          <select
            id="read-bible-font-select"
            className="mt-1.5 w-full rounded-lg border border-amber-900/18 bg-white/90 px-2.5 py-2 text-[15px] text-amber-950 outline-none ring-0 focus:border-amber-900/35 dark:border-stone-500/35 dark:bg-stone-950/80 dark:text-stone-100"
            value={prefs.font}
            onChange={(e) => setFont(e.target.value as typeof prefs.font)}
          >
            <option value="system">{t("pages.read.typography.fontSystem")}</option>
            <option value="songti">{t("pages.read.typography.fontSongti")}</option>
            <option value="kaiti">{t("pages.read.typography.fontKaiti")}</option>
            <option value="heiti">{t("pages.read.typography.fontHeiti")}</option>
          </select>
          <label className="mt-3 block text-[13px] font-medium text-amber-950/90 dark:text-stone-200" htmlFor="read-bible-size-select">
            {t("pages.read.typography.sizeLabel")}
          </label>
          <select
            id="read-bible-size-select"
            className="mt-1.5 w-full rounded-lg border border-amber-900/18 bg-white/90 px-2.5 py-2 text-[15px] text-amber-950 outline-none focus:border-amber-900/35 dark:border-stone-500/35 dark:bg-stone-950/80 dark:text-stone-100"
            value={prefs.size}
            onChange={(e) => setSize(e.target.value as typeof prefs.size)}
          >
            <option value="s">{t("pages.read.typography.sizeS")}</option>
            <option value="m">{t("pages.read.typography.sizeM")}</option>
            <option value="l">{t("pages.read.typography.sizeL")}</option>
            <option value="xl">{t("pages.read.typography.sizeXl")}</option>
          </select>
        </div>
      ) : null}
    </div>
  );
}
