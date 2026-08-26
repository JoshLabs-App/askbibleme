"use client";

import { useCallback, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import { ScriptureSpeedRateIcon } from "@/components/bible/ScriptureSpeedRateIcon";
import {
  IconPause,
  IconPlay,
  IconScriptureRepeatBook,
  IconScriptureRepeatChapter,
  IconSkipForward,
} from "@/components/ui/MediaPlaybackIcons";

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
  onRead: () => void;
  onCycleRate: () => void;
  onCycleLoop: () => void;
  readIconName?: "search" | "menu-book";
  readAccessibilityLabel?: string;
};

const seekClass =
  "read-scripture-dock-seek h-5 w-full min-w-[2.75rem] max-w-full flex-1 cursor-pointer appearance-none bg-transparent accent-amber-700/80 disabled:cursor-not-allowed disabled:opacity-35";

const sideBtnClass =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--bc-read-book,#3d2e24)] transition active:scale-[0.97] disabled:opacity-35";

/** 读经播放坞 — 对齐 App `ReadScripturePlaybackDock`。 */
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
  const [dragging, setDragging] = useState(false);
  const [moved, setMoved] = useState(false);
  const [seekVal, setSeekVal] = useState(0);

  const durOk = durationSec > 0.05 && Number.isFinite(durationSec);
  const prog = durOk ? clamp01(currentSec / durationSec) : 0;
  const sliderValue = dragging && moved ? seekVal : prog;
  const playLocked = disabled || busy;
  const live = playing || preparing;

  const onSeekInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const v = clamp01(Number(e.currentTarget.value));
      setMoved(true);
      setSeekVal(v);
      seekRatio(v);
    },
    [seekRatio],
  );

  const endDrag = useCallback(() => {
    setDragging(false);
    setMoved(false);
  }, []);

  if (!visible) return null;

  const loopLabel =
    loopMode === "chapter"
      ? t("pages.read.planPlayRepeatChapter")
      : loopMode === "book"
        ? t("playback.scriptureRepeatBookShort")
        : t("pages.read.planPlayRepeatOff");

  return (
    <div
      data-shell-swipe-nav-exclude
      className={[
        "pointer-events-auto w-full min-w-0 max-w-[min(100%,var(--read-parchment-column-max,28rem))]",
        "border-t border-[var(--bc-read-border,rgba(92,64,48,0.14))] bg-transparent px-3 pt-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={t("playback.scriptureDockLabel")}
    >
      <div className="mb-2 flex items-center gap-2 text-[11px] tabular-nums text-[var(--bc-read-book,#3d2e24)] sm:text-xs">
        <span className="shrink-0">{formatClock(currentSec)}</span>
        <span className="text-[var(--bc-read-muted,rgba(61,46,36,0.45))]">/</span>
        <span className="shrink-0 opacity-80">{durOk ? formatClock(durationSec) : "—"}</span>
        <input
          type="range"
          className={seekClass}
          min={0}
          max={1}
          step={0.001}
          value={sliderValue}
          disabled={!durOk || !live}
          aria-label={t("playback.scriptureSeekAria")}
          onPointerDown={(e) => {
            if (!durOk) return;
            if (e.pointerType === "mouse" && e.button !== 0) return;
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            setDragging(true);
            setMoved(false);
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onInput={onSeekInput}
        />
      </div>

      <div className="flex items-center justify-between gap-1 pb-1">
        <button
          type="button"
          className={sideBtnClass}
          disabled={disabled}
          aria-label={readAccessibilityLabel ?? t("pages.read.planPlayReadChapter")}
          onClick={onRead}
        >
          <ShellMaterialIcon name={readIconName} size={22} color="currentColor" />
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-2">
          <button
            type="button"
            className={`${sideBtnClass} min-w-[2.5rem] px-1`}
            disabled={disabled}
            aria-label={`语音速度 ${scripturePlaybackRate}x`}
            onClick={onCycleRate}
          >
            <ScriptureSpeedRateIcon rate={scripturePlaybackRate} />
          </button>

          <button
            type="button"
            className={[
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-[0.97] disabled:opacity-35",
              playing ? "bg-[var(--brand-logo-background,#f5d547)] text-[var(--bc-read-book,#3d2e24)]" : "bg-[var(--bc-read-book,#3d2e24)] text-white",
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
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
            ) : playing ? (
              <IconPause className="h-[22px] w-[22px]" />
            ) : (
              <IconPlay className="h-[22px] w-[22px] translate-x-[0.5px]" />
            )}
          </button>

          <button
            type="button"
            className={[
              sideBtnClass,
              loopMode !== "off" ? "bg-[rgba(92,64,48,0.1)]" : "",
            ].join(" ")}
            aria-pressed={loopMode !== "off"}
            aria-label={loopLabel}
            onClick={onCycleLoop}
          >
            {loopMode === "chapter" ? (
              <IconScriptureRepeatChapter className="h-[18px] w-[18px]" />
            ) : (
              <IconScriptureRepeatBook
                className={["h-[18px] w-[18px]", loopMode === "book" ? "" : "opacity-45"].join(" ")}
              />
            )}
          </button>
        </div>

        <button
          type="button"
          className={sideBtnClass}
          disabled={playLocked}
          aria-label={t("pages.read.planPlayNextChapter")}
          onClick={onNext}
        >
          <IconSkipForward className="h-[22px] w-[22px]" />
        </button>
      </div>
    </div>
  );
}
