"use client";

import { useEffect, useRef, useState } from "react";
import { HomePrayerVerseDockSettings } from "@/components/home/HomePrayerVerseDockSettings";
import { useLocale } from "@/components/i18n/LocaleProvider";

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
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 金句页顶栏右上：与首页 `HomeDashboard` 用户菜单同构（圆钮 + 深色磨砂浮层 + 点外关闭 / Esc）。
 * @param variant `dark`：叠在全幅背景图上时用浅色图标（与 `AppShellTopBar` onDark 一致）。
 */
export function GoldenVersesSettingsTopBar({ variant = "light" }: { variant?: "light" | "dark" }) {
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

  const onDark = variant === "dark";

  return (
    <div className="pointer-events-auto relative" ref={rootRef}>
      <button
        type="button"
        id="golden-verse-settings-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("pages.goldenVerses.settings")}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? "golden-verse-settings-popover" : undefined}
        className={
          onDark
            ? "flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition hover:bg-white/12 active:scale-[0.97]"
            : "flex h-9 w-9 items-center justify-center rounded-full text-ink/85 transition hover:bg-ink/[0.06] active:scale-[0.97]"
        }
      >
        <IconGear className="h-[15px] w-[15px] opacity-88" />
      </button>
      {open ? (
        <div
          id="golden-verse-settings-popover"
          role="dialog"
          aria-label={t("pages.goldenVerses.settings")}
          className="absolute right-0 top-[calc(100%+0.35rem)] z-[60] w-[min(22rem,calc(100vw-1.25rem))] max-h-[min(32rem,72vh)] overflow-y-auto overscroll-y-contain rounded-xl border border-white/20 bg-ink/88 py-1 text-canvas shadow-xl backdrop-blur-md [-webkit-overflow-scrolling:touch]"
        >
          <HomePrayerVerseDockSettings placement="popover" sections={["goldenFont"]} />
        </div>
      ) : null}
    </div>
  );
}
