"use client";

import { useCallback, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { isCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";

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

type Placement = "fixedShell" | "videoStage";

type Props = { placement: Placement };

const chipBase =
  "shrink-0 rounded-full border border-white/14 px-2 py-0.5 font-medium transition active:scale-[0.98] sm:px-2.5";
const chipOff = "bg-white/[0.06] text-white/72 hover:bg-white/[0.1] hover:text-white/88";
const chipOn = "border-amber-200/35 bg-amber-100/14 text-amber-50";

const seekClass =
  "read-scripture-dock-seek h-5 w-full min-w-[2.75rem] max-w-full flex-1 cursor-pointer appearance-none bg-transparent accent-amber-200/95 disabled:cursor-not-allowed disabled:opacity-35";

/**
 * 和合本整章经朗读播放中：底栏图标上方极简条（时长 + 可拖动进度 + 重复本章/本卷）。
 */
export function ScriptureAudioDockStrip({ placement }: Props) {
  const { t } = useLocale();
  const {
    playing,
    effectiveSrc,
    currentSec,
    durationSec,
    seekRatio,
    scriptureAudioRepeatMode,
    setScriptureAudioRepeatMode,
  } = useMusicShellPlayback();

  const [dragging, setDragging] = useState(false);
  const [moved, setMoved] = useState(false);
  const [seekVal, setSeekVal] = useState(0);

  const durOk = durationSec > 0.05 && Number.isFinite(durationSec);
  const prog = durOk ? clamp01(currentSec / durationSec) : 0;
  const sliderValue = dragging && moved ? seekVal : prog;

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

  if (placement !== "fixedShell") return null;
  if (!playing || !isCuvChapterAudioEffectiveSrc(effectiveSrc)) return null;

  const cur = formatClock(currentSec);
  const dur = durOk ? formatClock(durationSec) : "—";

  const chip = (mode: "chapter" | "book") => {
    const on = scriptureAudioRepeatMode === mode;
    return (
      <button
        type="button"
        onClick={() => setScriptureAudioRepeatMode(on ? "off" : mode)}
        className={[chipBase, on ? chipOn : chipOff].join(" ")}
        aria-pressed={on}
      >
        {mode === "chapter" ? t("playback.scriptureRepeatChapterShort") : t("playback.scriptureRepeatBookShort")}
      </button>
    );
  };

  return (
    <div
      className={[
        "pointer-events-auto flex w-full min-w-0 max-w-[min(100%,28rem)] items-center gap-2 rounded-full border-0",
        "bg-black/40 px-3 py-1.5 text-[11px] leading-tight text-white/88 shadow-[0_6px_28px_-8px_rgba(0,0,0,0.55)] backdrop-blur-md",
        "supports-[backdrop-filter]:bg-black/34 sm:max-w-lg sm:gap-2.5 sm:px-3 sm:py-1.5 sm:text-xs",
      ].join(" ")}
      aria-label={t("playback.scriptureDockLabel")}
    >
      <span className="min-w-0 shrink-0 tabular-nums tracking-tight text-white/92">
        <span className="text-white">{cur}</span>
        <span className="mx-0.5 text-white/38">/</span>
        <span className="text-white/72">{dur}</span>
      </span>
      <input
        type="range"
        className={seekClass}
        min={0}
        max={1}
        step={0.001}
        value={sliderValue}
        disabled={!durOk}
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
      <span className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5">
        {chip("chapter")}
        {chip("book")}
      </span>
    </div>
  );
}
