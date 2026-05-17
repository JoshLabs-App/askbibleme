"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useScreenWakeLock } from "@/hooks/useScreenWakeLock";
import {
  useMusicShellPlayback,
  type MusicShellSleepTimerMinutes,
} from "@/components/music/MusicShellPlaybackContext";

const SLEEP_OPTIONS: MusicShellSleepTimerMinutes[] = [30, 60, 120];

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

/** 与自然顶栏铃铛同尺寸、同对比度 */
const TOP_BAR_TIMER_BTN =
  "touch-manipulation flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition active:scale-[0.97] text-white/[0.9] hover:bg-white/[0.1]";

type Props = {
  className?: string;
  /** 嵌入自然首页设置面板：无顶栏按钮，直接展示选项 */
  embedded?: boolean;
  /** 与首页设置单卡同屏：去掉说明、缩小按钮 */
  compact?: boolean;
};

function HomeSleepTimerPanelContent({
  sleepTimerMinutes,
  setSleepTimerMinutes,
  stayAwake,
  setStayAwake,
  onPickTimer,
  compact = false,
}: {
  sleepTimerMinutes: number;
  setSleepTimerMinutes: (m: MusicShellSleepTimerMinutes | 0) => void;
  stayAwake: boolean;
  setStayAwake: (v: boolean | ((prev: boolean) => boolean)) => void;
  onPickTimer?: () => void;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const pillClass = compact
    ? "min-w-[2.25rem] rounded-full px-2 py-0.5 text-[10px]"
    : "min-w-[2.5rem] rounded-full px-2.5 py-1 text-[12px]";

  return (
    <>
      {compact ? null : (
        <p className="mb-2 px-0.5 text-[11px] leading-snug text-white/72">{t("music.sleepTimer.popoverLead")}</p>
      )}
      <div className="flex justify-center gap-1" role="group" aria-label={t("music.sleepTimer.watchAria")}>
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
                onPickTimer?.();
              }}
              className={
                selected
                  ? `${pillClass} bg-sky-500/90 font-medium text-white`
                  : `${pillClass} border border-white/12 bg-white/[0.06] text-white/85 transition hover:bg-white/[0.1]`
              }
            >
              {t(sleepLabelKey(m))}
            </button>
          );
        })}
      </div>

      <div className={compact ? "mt-1.5 flex min-h-[28px] items-center justify-between gap-2" : "mt-2.5 border-t border-white/15 pt-2.5"}>
        {compact ? (
          <>
            <span className="text-[10px] text-white/55">{t("music.sleepTimer.stayAwakeLabel")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={stayAwake}
              aria-label={t("music.sleepTimer.stayAwakeLabel")}
              onClick={(e) => {
                e.stopPropagation();
                setStayAwake((v) => !v);
              }}
              className={[
                "relative flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200",
                stayAwake ? "justify-end border border-sky-400/60 bg-sky-500/75" : "justify-start border border-white/22 bg-white/[0.08]",
              ].join(" ")}
            >
              <span className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm" aria-hidden />
            </button>
          </>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 pr-1">
              <p className="text-[12px] font-medium leading-snug text-white/90">{t("music.sleepTimer.stayAwakeLabel")}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-white/55">{t("music.sleepTimer.stayAwakeHint")}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={stayAwake}
              aria-label={t("music.sleepTimer.stayAwakeLabel")}
              onClick={(e) => {
                e.stopPropagation();
                setStayAwake((v) => !v);
              }}
              className={[
                "relative mt-0.5 flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200",
                stayAwake ? "justify-end border border-sky-400/60 bg-sky-500/75" : "justify-start border border-white/22 bg-white/[0.08]",
              ].join(" ")}
            >
              <span className="pointer-events-none block h-6 w-6 rounded-full bg-white shadow-sm" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * 壳层睡眠定时器（到时只暂停壳层音乐）+ 可选屏幕常亮（Wake Lock）。自然首页顶栏。
 */
export function HomeSleepTimerControl({ className = "", embedded = false, compact = false }: Props) {
  const { t } = useLocale();
  const { sleepTimerMinutes, setSleepTimerMinutes } = useMusicShellPlayback();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [stayAwake, setStayAwake] = useState(false);
  const popoverWrapRef = useRef<HTMLDivElement>(null);

  useScreenWakeLock(stayAwake);

  if (embedded) {
    return (
      <div className={className}>
        <HomeSleepTimerPanelContent
          sleepTimerMinutes={sleepTimerMinutes}
          setSleepTimerMinutes={setSleepTimerMinutes}
          stayAwake={stayAwake}
          setStayAwake={setStayAwake}
          compact={compact}
        />
      </div>
    );
  }

  const watchClass = [
    TOP_BAR_TIMER_BTN,
    sleepTimerMinutes !== 0
      ? "border-0 bg-white/[0.14] text-white [filter:drop-shadow(0_0_8px_rgba(125,211,252,0.65))_drop-shadow(0_0_16px_rgba(125,211,252,0.35))]"
      : "border-0 bg-transparent text-white/75 hover:bg-white/[0.08] hover:text-white",
    popoverOpen && sleepTimerMinutes === 0
      ? "text-white [filter:drop-shadow(0_0_6px_rgba(255,255,255,0.85))_drop-shadow(0_0_14px_rgba(255,255,255,0.35))]"
      : "",
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
    <div ref={popoverWrapRef} className={["relative flex shrink-0 flex-col items-end overflow-visible", className].join(" ")}>
      <button
        type="button"
        aria-expanded={popoverOpen}
        aria-haspopup="dialog"
        aria-controls="global-sleep-timer-popover"
        aria-label={t("music.sleepTimer.watchAria")}
        onClick={() => setPopoverOpen((o) => !o)}
        className={watchClass}
      >
        <IconPocketWatch className="h-[1.25rem] w-[1.25rem] opacity-90" />
      </button>

      {popoverOpen ? (
        <div
          id="global-sleep-timer-popover"
          role="dialog"
          aria-label={t("music.sleepTimer.watchAria")}
          className={[
            "absolute z-[60] w-[min(calc(100vw-2rem),17.5rem)] min-w-[12.5rem] rounded-xl border border-white/25 bg-black/35 px-2.5 py-2 shadow-xl ring-1 ring-white/15 backdrop-blur-xl",
            "right-0 top-full mt-2 translate-y-0",
            "landscape:right-full landscape:top-1/2 landscape:mt-0 landscape:mr-2 landscape:-translate-y-1/2",
          ].join(" ")}
        >
          <HomeSleepTimerPanelContent
            sleepTimerMinutes={sleepTimerMinutes}
            setSleepTimerMinutes={setSleepTimerMinutes}
            stayAwake={stayAwake}
            setStayAwake={setStayAwake}
            onPickTimer={() => setPopoverOpen(false)}
            compact={compact}
          />
        </div>
      ) : null}
    </div>
  );
}
