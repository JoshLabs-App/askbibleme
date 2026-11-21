"use client";

import { useCallback, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import { ScriptureSpeedRateIcon } from "@/components/bible/ScriptureSpeedRateIcon";
import { IconScriptureRepeatGlyph } from "@/components/ui/MediaPlaybackIcons";

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

type LoopMode = "off" | "chapter" | "book";

type Props = {
  visible?: boolean;
  busy?: boolean;
  disabled?: boolean;
  className?: string;
  playing: boolean;
  preparing?: boolean;
  currentSec: number;
  durationSec: number;
  seekRatio: (ratio: number) => void;
  scripturePlaybackRate: number;
  loopMode: LoopMode;
  onTogglePlay: () => void;
  onNext: () => void;
  onRead?: () => void;
  onCycleRate: () => void;
  onCycleLoop: () => void;
  readIconName?: "search" | "menu-book";
  readAccessibilityLabel?: string;
};

/**
 * 读经播放坞 — 100% 对齐安卓 `PlaybackDock.kt`（D-45）：
 * - 进度行：左已播时长 · 中 3px 金色细进度条（无浏览器圆滑块） · 右总时长
 * - 传输行：左 `MI.SEARCH` (24) | 中 `SpeedRateImage` (56×22) + `MI.PLAY_ARROW/PAUSE` (34 in 圆钮) + `RepeatGlyph` (24, 角标 1/B/无) | 右 `MI.SKIP_NEXT` (36)
 */
export function ReadScripturePlaybackDock({
  visible = true,
  busy = false,
  disabled = false,
  className,
  playing,
  preparing = false,
  currentSec,
  durationSec,
  seekRatio,
  scripturePlaybackRate,
  loopMode,
  onTogglePlay,
  onNext,
  onRead,
  onCycleRate,
  onCycleLoop,
  readIconName = "menu-book",
  readAccessibilityLabel,
}: Props) {
  const { t } = useLocale();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragFraction, setDragFraction] = useState<number | null>(null);

  const durOk = durationSec > 0.05 && Number.isFinite(durationSec);
  const prog = durOk ? clamp01(currentSec / durationSec) : 0;
  const fraction = dragFraction ?? prog;
  const playLocked = disabled || busy;

  const ratioFromClientX = useCallback((clientX: number): number | null => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return clamp01((clientX - rect.left) / rect.width);
  }, []);

  if (!visible) return null;

  const loopLabel =
    loopMode === "chapter"
      ? t("pages.read.planPlayRepeatChapter")
      : loopMode === "book"
        ? t("playback.scriptureRepeatBookShort")
        : t("pages.read.planPlayRepeatOff");

  const repeatBadge = loopMode === "chapter" ? "1" : loopMode === "book" ? "B" : null;

  return (
    <div
      data-shell-swipe-nav-exclude
      className={[
        "pointer-events-auto w-full min-w-0 max-w-[min(100%,var(--read-parchment-column-max,28rem))]",
        "rounded-2xl border border-[#DFD0B8] bg-[#F4EBDD] px-4 pt-2 pb-1.5 text-[#1C1410] shadow-[0_6px_22px_rgba(24,16,10,0.14)] dark:border-[#3A3026] dark:bg-[#1E1914] dark:text-[#F4EBE1] dark:shadow-[0_8px_26px_rgba(0,0,0,0.42)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={t("playback.scriptureDockLabel")}
    >
      {/* 进度行：对齐安卓 PlaybackDock.kt（左时间 · 3px 细进度轨 · 右总时长） */}
      <div className="flex min-h-[23px] items-center gap-2 px-1 text-[12px] font-medium tabular-nums text-[#5C4030] dark:text-[#D8C8B4]">
        <span className="min-w-[36px] shrink-0">{formatClock(currentSec)}</span>

        <div
          ref={trackRef}
          role="slider"
          tabIndex={durOk ? 0 : -1}
          aria-label={t("playback.scriptureSeekAria")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
          onPointerDown={(e) => {
            if (!durOk) return;
            if (e.pointerType === "mouse" && e.button !== 0) return;
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            const r = ratioFromClientX(e.clientX);
            if (r != null) setDragFraction(r);
          }}
          onPointerMove={(e) => {
            if (dragFraction == null || !durOk) return;
            const r = ratioFromClientX(e.clientX);
            if (r != null) setDragFraction(r);
          }}
          onPointerUp={(e) => {
            if (!durOk) return;
            const r = ratioFromClientX(e.clientX) ?? dragFraction;
            setDragFraction(null);
            if (r != null) seekRatio(r);
          }}
          onPointerCancel={() => setDragFraction(null)}
          onKeyDown={(e) => {
            if (!durOk) return;
            if (e.key === "ArrowRight") {
              e.preventDefault();
              seekRatio(clamp01(prog + 0.05));
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              seekRatio(clamp01(prog - 0.05));
            }
          }}
          className={[
            "flex h-6 flex-1 items-center",
            durOk ? "cursor-pointer touch-none" : "cursor-default",
          ].join(" ")}
        >
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-[rgba(92,64,48,0.22)] dark:bg-[rgba(237,226,207,0.28)]">
            <div
              className="h-full rounded-full bg-[#FFB101]"
              style={{ width: `${fraction * 100}%` }}
            />
          </div>
        </div>

        <span className="min-w-[36px] shrink-0 text-right">
          {durOk ? formatClock(durationSec) : "—:—"}
        </span>
      </div>

      {/* 传输行：对齐安卓 PlaybackDock.kt 经典 5 键对称布局 */}
      <div className="mt-0.5 flex items-center justify-between px-1">
        {onRead ? (
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-[#1C1410] outline-none transition active:scale-95 disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-amber-700/50 dark:text-[#F4EBE1]"
            disabled={disabled}
            aria-label={readAccessibilityLabel ?? t("pages.read.planPlayReadChapter")}
            onClick={onRead}
          >
            <ShellMaterialIcon name={readIconName} size={24} color="currentColor" />
          </button>
        ) : (
          <div className="h-11 w-11 shrink-0" aria-hidden />
        )}

        <div className="flex items-center justify-center gap-5 sm:gap-7">
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[56px] shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-[#1C1410] outline-none transition active:scale-95 disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-amber-700/50 dark:text-[#F4EBE1]"
            disabled={disabled}
            aria-label={`语音速度 ${scripturePlaybackRate}x`}
            onClick={onCycleRate}
          >
            <ScriptureSpeedRateIcon rate={scripturePlaybackRate} />
          </button>

          <button
            type="button"
            className={[
              "inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-0 p-0 outline-none transition active:scale-[0.97] disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-amber-700/50",
              playing
                ? "bg-[#FFB101] text-[#1C1410]"
                : "bg-[#1C1410] text-[#FAF5EC] dark:bg-[#F4EBE1] dark:text-[#1C1410]",
            ].join(" ")}
            disabled={playLocked}
            aria-label={
              preparing
                ? t("pages.read.chapterAudioPreparing")
                : playing
                  ? t("pages.read.chapterAudioPause")
                  : t("pages.read.planPlayPlay")
            }
            aria-pressed={playing}
            aria-busy={preparing || busy}
            onClick={onTogglePlay}
          >
            {busy || preparing ? (
              <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
            ) : (
              <ShellMaterialIcon
                name={playing ? "pause" : "play-arrow"}
                size={34}
                color="currentColor"
              />
            )}
          </button>

          <button
            type="button"
            className={[
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 p-0 outline-none transition active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-700/50",
              loopMode !== "off"
                ? "bg-[rgba(92,64,48,0.10)] text-[#1C1410] dark:bg-[rgba(237,226,207,0.18)] dark:text-[#F4EBE1]"
                : "bg-transparent text-[#5C4030] dark:text-[#D8C8B4]",
            ].join(" ")}
            aria-pressed={loopMode !== "off"}
            aria-label={loopLabel}
            onClick={onCycleLoop}
          >
            <IconScriptureRepeatGlyph badge={repeatBadge} className="h-6 w-6" />
          </button>
        </div>

        <button
          type="button"
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-[#1C1410] outline-none transition active:scale-95 disabled:opacity-35 focus-visible:ring-2 focus-visible:ring-amber-700/50 dark:text-[#F4EBE1]"
          disabled={playLocked}
          aria-label={t("pages.read.planPlayNextChapter")}
          onClick={onNext}
        >
          <ShellMaterialIcon name="skip-next" size={36} color="currentColor" />
        </button>
      </div>
    </div>
  );
}
