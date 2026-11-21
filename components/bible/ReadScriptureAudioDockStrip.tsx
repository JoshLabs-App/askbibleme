"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ReadScripturePlaybackDock } from "@/components/bible/ReadScripturePlaybackDock";
import { useReadBibleTranslationSettings } from "@/components/bible/ReadBibleTypographyProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { useReadChapterPageAudioAvailable } from "@/hooks/useReadChapterPageAudioAvailable";
import { isCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";
import {
  parseReadChapterPathname,
  resolveChapterPageScripturePlayTarget,
} from "@/lib/read/resolve-chapter-page-scripture-play-target";
import { shouldShowReadScriptureAudioDock } from "@/lib/read/read-scripture-dock-visibility";
import { nextScripturePlaybackRate } from "@/lib/read/scripture-playback-rate-web";

type Placement = "fixedShell" | "videoStage";

type Props = { placement: Placement };

/** 读经章页播放坞 — 对齐 App `ReadScriptureAudioDockStrip`。 */
export function ReadScriptureAudioDockStrip({ placement }: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { t } = useLocale();
  const { chapterAudioTranslationId } = useReadBibleTranslationSettings();
  const readChapterAudioAvailable = useReadChapterPageAudioAvailable();
  const chapterRoute = parseReadChapterPathname(pathname);
  const onChapterPage = chapterRoute !== null;


  const {
    playing,
    loading,
    effectiveSrc,
    currentSec,
    durationSec,
    seekRatio,
    scripturePlaybackRate,
    setScripturePlaybackRate,
    scriptureAudioRepeatMode,
    setScriptureAudioRepeatMode,
    playScriptureChapter,
    skipScriptureNext,
    pauseScripturePlayback,
    togglePlayScripture,
  } = useMusicShellPlayback();

  const scriptureActive = isCuvChapterAudioEffectiveSrc(effectiveSrc);
  const preparing = loading && (scriptureActive || onChapterPage);
  const show = shouldShowReadScriptureAudioDock({
    readChapterAudioAvailable,
    onChapterPage,
    playing: playing && scriptureActive,
    scripturePreparing: preparing,
  });

  const onTogglePlay = useCallback(() => {
    if (playing && scriptureActive) {
      pauseScripturePlayback();
      return;
    }
    if (onChapterPage) {
      const route = parseReadChapterPathname(pathname);
      if (!route) return;
      const target = resolveChapterPageScripturePlayTarget(pathname, {
        bookId: route.bookId,
        chapter: route.chapter,
        translationId: chapterAudioTranslationId,
      });
      if (target) {
        void playScriptureChapter(target);
        return;
      }
    }
    void togglePlayScripture();
  }, [
    chapterAudioTranslationId,
    onChapterPage,
    pathname,
    pauseScripturePlayback,
    playScriptureChapter,
    playing,
    scriptureActive,
    togglePlayScripture,
  ]);

  const onNext = useCallback(() => {
    void skipScriptureNext();
  }, [skipScriptureNext]);

  const onCycleRate = useCallback(() => {
    setScripturePlaybackRate(nextScripturePlaybackRate(scripturePlaybackRate));
  }, [scripturePlaybackRate, setScripturePlaybackRate]);

  const onCycleLoop = useCallback(() => {
    const next =
      scriptureAudioRepeatMode === "off"
        ? "chapter"
        : scriptureAudioRepeatMode === "chapter"
          ? "book"
          : "off";
    setScriptureAudioRepeatMode(next);
  }, [scriptureAudioRepeatMode, setScriptureAudioRepeatMode]);

  const onOpenSearch = useCallback(() => {
    if (chapterRoute) {
      router.push(
        `/read/search?bookId=${encodeURIComponent(chapterRoute.bookId)}&chapter=${chapterRoute.chapter}`,
      );
      return;
    }
    router.push("/read/search");
  }, [chapterRoute, router]);

  if (placement !== "fixedShell" || !show) return null;

  const loopMode =
    scriptureAudioRepeatMode === "chapter"
      ? "chapter"
      : scriptureAudioRepeatMode === "book"
        ? "book"
        : "off";

  return (
    <ReadScripturePlaybackDock
      visible
      busy={preparing}
      playing={playing && scriptureActive}
      preparing={preparing}
      currentSec={currentSec}
      durationSec={durationSec}
      seekRatio={seekRatio}
      scripturePlaybackRate={scripturePlaybackRate}
      loopMode={loopMode}
      onTogglePlay={onTogglePlay}
      onNext={onNext}
      onRead={onOpenSearch}
      readIconName="search"
      readAccessibilityLabel={t("pages.read.chapterChromeSearch")}
      onCycleRate={onCycleRate}
      onCycleLoop={onCycleLoop}
    />
  );
}
