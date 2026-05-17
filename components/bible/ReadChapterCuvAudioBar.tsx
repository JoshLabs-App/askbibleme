"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCuvChapterAudioVoice } from "@/components/bible/CuvChapterAudioVoiceContext";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import {
  resolveCuvChapterAudioPlayableSrc,
  translationSupportsCuvChapterAudio,
} from "@/lib/bible/cuv-chapter-audio";
import { getTeochewNtManifestEntry } from "@/lib/bible/teochew-nt-audio";
import { shellPlaybackUrlsEqual } from "@/lib/music-companion/shell-playback-storage";

type Props = {
  translationId: string;
  bookId: string;
  bookName: string;
  chapter: number;
};

/**
 * 和合本章节朗读：人声在右上阅读设置；此处仅播放控制。
 */
export function ReadChapterCuvAudioBar({ translationId, bookId, bookName, chapter }: Props) {
  const { t } = useLocale();
  const { effectiveVoiceId } = useCuvChapterAudioVoice();
  const {
    effectiveSrc,
    playing,
    setPlaybackSrc,
    togglePlay,
    pausePlayback,
    loading,
    getAudioElement,
  } = useMusicShellPlayback();

  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [resolveState, setResolveState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const pushedRef = useRef(false);

  const supported = translationSupportsCuvChapterAudio(translationId);
  const playVoice = effectiveVoiceId(bookId);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    setResolveState("busy");
    setResolvedSrc(null);
    void (async () => {
      const r = await resolveCuvChapterAudioPlayableSrc({
        bookName,
        bookId,
        chapter,
        voiceId: playVoice,
      });
      if (cancelled) return;
      if (!r.ok) {
        setResolveState("err");
        return;
      }
      setResolvedSrc(r.src);
      setResolveState("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, bookName, bookId, chapter, playVoice]);

  useEffect(() => {
    return () => {
      if (pushedRef.current) {
        setPlaybackSrc(null);
        pushedRef.current = false;
      }
    };
  }, [setPlaybackSrc]);

  const isThisChapterBound =
    Boolean(resolvedSrc) && Boolean(effectiveSrc.trim()) && shellPlaybackUrlsEqual(resolvedSrc!, effectiveSrc);

  const onToggle = useCallback(() => {
    if (!resolvedSrc || resolveState !== "ok" || loading) return;
    if (isThisChapterBound && playing) {
      pausePlayback();
      return;
    }
    if (!isThisChapterBound) {
      setPlaybackSrc(resolvedSrc);
      pushedRef.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const a = getAudioElement();
          if (a?.paused) void togglePlay();
        });
      });
      return;
    }
    void togglePlay();
  }, [
    resolvedSrc,
    resolveState,
    loading,
    isThisChapterBound,
    playing,
    setPlaybackSrc,
    pausePlayback,
    togglePlay,
    getAudioElement,
  ]);

  if (!supported) return null;

  const disabled = resolveState === "busy" || resolveState === "idle" || !resolvedSrc || loading;
  const label =
    resolveState === "err"
      ? playVoice === "teochew-nt" && getTeochewNtManifestEntry(bookId, chapter)
        ? t("pages.read.chapterAudioTeochewNotOnDisk")
        : t("pages.read.chapterAudioUnavailable")
      : resolveState === "busy"
        ? t("pages.read.chapterAudioPreparing")
        : isThisChapterBound && playing
          ? t("pages.read.chapterAudioPause")
          : playVoice === "teochew-nt"
            ? t("pages.read.chapterAudioPlayTeochew")
            : t("pages.read.chapterAudioPlay");

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={disabled || resolveState === "err"}
        onClick={onToggle}
        className="rounded-full border border-amber-900/14 bg-white/35 px-3 py-1.5 text-[12px] font-medium text-amber-950/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:bg-white/55 disabled:cursor-not-allowed disabled:opacity-45 dark:border-stone-600/45 dark:bg-stone-800/45 dark:text-stone-100/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:bg-stone-800/65"
      >
        {label}
      </button>
      <p className="text-[11px] leading-snug text-amber-900/48 dark:text-stone-500">
        {playVoice === "teochew-nt" ? t("pages.read.chapterAudioTeochewHint") : t("pages.read.chapterAudioHint")}
      </p>
    </div>
  );
}
