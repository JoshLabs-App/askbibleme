"use client";

import { useEffect, useRef, useState } from "react";
import { HomePrayerVerseDockSettings, type NatureVerseTextScaleDockProps } from "@/components/home/HomePrayerVerseDockSettings";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { AppShellTopBarTone } from "@/components/app-shell/AppShellTopBar";

function IconVerseTypography(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  tone?: AppShellTopBarTone;
  /** 与首页一致：经文 A−/A＋；由父级传入以便同步 `HomeVerseRotator` zoom */
  natureVerseTextScale: NatureVerseTextScaleDockProps;
};

/** 与首页 `HomeDashboard` 右上齿轮同源：金句字体/字面 + 本页经文缩放 */
export function HomeVerseTypographyTopAccessory({ tone = "onDark", natureVerseTextScale }: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  const onLight = tone === "onLight";
  const btnClass = onLight
    ? "flex h-9 w-9 items-center justify-center rounded-full text-ink/85 transition hover:bg-ink/[0.06] active:scale-[0.97]"
    : "flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/12 active:scale-[0.97]";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("nature.homeVerse.typographyMenu")}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? "home-verse-typography-popover" : undefined}
        className={btnClass}
      >
        <IconVerseTypography className="h-[15px] w-[15px] opacity-88" />
      </button>
      {open ? (
        <div
          id="home-verse-typography-popover"
          role="dialog"
          aria-label={t("pages.goldenVerses.settings")}
          className="absolute right-0 top-[calc(100%+0.35rem)] z-[60] w-[min(22rem,calc(100vw-1.25rem))] max-h-[min(32rem,72vh)] overflow-y-auto overscroll-y-contain rounded-xl border border-white/20 bg-ink/88 py-1 text-canvas shadow-xl backdrop-blur-md [-webkit-overflow-scrolling:touch]"
        >
          <HomePrayerVerseDockSettings
            placement="popover"
            sections={["goldenFont"]}
            natureVerseTextScale={natureVerseTextScale}
          />
        </div>
      ) : null}
    </div>
  );
}
