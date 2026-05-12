"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  useMusicShellPlayback,
  type MusicShellSleepTimerMinutes,
} from "@/components/music/MusicShellPlaybackContext";

const SLEEP_OPTIONS: MusicShellSleepTimerMinutes[] = [30, 60, 120];

function IconMusicNotes({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="7" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  );
}

function IconRelaxRipple({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="2.25" />
    </svg>
  );
}

function IconPocketWatch({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2.5V5" />
      <path d="M9.5 5h5" />
      <circle cx="12" cy="14.5" r="7" />
      <path d="M12 14.5V11" />
    </svg>
  );
}

function sleepLabelKey(m: MusicShellSleepTimerMinutes): string {
  if (m === 30) return "music.sleepTimer.m30";
  if (m === 60) return "music.sleepTimer.m60";
  return "music.sleepTimer.m120";
}

/**
 * 自然页底区：音乐、放松入口与全局定时（怀表）。`/music` 在主导航外，由此处补充；放松亦保留快捷入口。
 */
export function HomeMusicRelaxShortcuts({ className = "" }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const { t } = useLocale();
  const { sleepTimerMinutes, setSleepTimerMinutes } = useMusicShellPlayback();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverWrapRef = useRef<HTMLDivElement>(null);

  const onMusic = pathname === "/music" || pathname.startsWith("/music/");
  const onRelax = pathname === "/relax" || pathname.startsWith("/relax/");

  const shortcutLinkClass = (active: boolean) =>
    [
      "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition sm:h-10 sm:w-10",
      active
        ? "border-sky-300/60 bg-white/[0.18] text-white shadow-[0_0_0_1px_rgba(125,211,252,0.25)]"
        : "border-white/15 bg-transparent text-white/75 hover:border-white/25 hover:bg-white/[0.06] hover:text-white",
    ].join(" ");

  const watchClass = [
    "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition sm:h-10 sm:w-10",
    sleepTimerMinutes !== 0
      ? "border-sky-300/60 bg-white/[0.18] text-white shadow-[0_0_0_1px_rgba(125,211,252,0.25)]"
      : "border-white/15 bg-transparent text-white/75 hover:border-white/25 hover:bg-white/[0.06] hover:text-white",
    popoverOpen && sleepTimerMinutes === 0 ? "ring-1 ring-white/30" : "",
  ].join(" ");

  useEffect(() => {
    if (!popoverOpen) return;
    const onDoc = (e: MouseEvent) => {
      const w = popoverWrapRef.current;
      if (!w || w.contains(e.target as Node)) return;
      setPopoverOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopoverOpen(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [popoverOpen]);

  return (
    <nav
      className={`relative flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-4 ${className}`}
      aria-label={t("music.home.shortcutsAria")}
    >
      <Link
        href="/music"
        prefetch={false}
        aria-current={onMusic ? "page" : undefined}
        aria-label={t("nav.music")}
        className={shortcutLinkClass(onMusic)}
      >
        <IconMusicNotes className="h-[1.15rem] w-[1.15rem] sm:h-5 sm:w-5" />
      </Link>
      <Link
        href="/relax"
        prefetch={false}
        aria-current={onRelax ? "page" : undefined}
        aria-label={t("nav.relax")}
        className={shortcutLinkClass(onRelax)}
      >
        <IconRelaxRipple className="h-[1.15rem] w-[1.15rem] sm:h-5 sm:w-5" />
      </Link>
      <div ref={popoverWrapRef} className="relative flex shrink-0 flex-col items-center">
        <button
          type="button"
          aria-expanded={popoverOpen}
          aria-haspopup="dialog"
          aria-controls="global-sleep-timer-popover"
          aria-label={t("music.sleepTimer.watchAria")}
          onClick={() => setPopoverOpen((o) => !o)}
          className={watchClass}
        >
          <IconPocketWatch className="h-[1.15rem] w-[1.15rem] sm:h-5 sm:w-5" />
        </button>

        {popoverOpen ? (
          <div
            id="global-sleep-timer-popover"
            role="dialog"
            aria-label={t("music.sleepTimer.watchAria")}
            className="absolute bottom-[calc(100%+0.5rem)] left-1/2 top-auto z-30 w-auto min-w-[9.5rem] -translate-x-1/2 rounded-xl border border-white/25 bg-black/35 px-2 py-2 shadow-xl ring-1 ring-white/15 backdrop-blur-xl"
          >
            <div className="flex justify-center gap-1" role="group">
              {SLEEP_OPTIONS.map((m) => {
                const selected = sleepTimerMinutes === m;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      if (sleepTimerMinutes === m) setSleepTimerMinutes(0);
                      else setSleepTimerMinutes(m);
                      setPopoverOpen(false);
                    }}
                    className={
                      selected
                        ? "min-w-[2.5rem] rounded-full bg-sky-500/90 px-2.5 py-1 text-[12px] font-medium text-white"
                        : "min-w-[2.5rem] rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 text-[12px] text-white/85 transition hover:bg-white/[0.1]"
                    }
                  >
                    {t(sleepLabelKey(m))}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
