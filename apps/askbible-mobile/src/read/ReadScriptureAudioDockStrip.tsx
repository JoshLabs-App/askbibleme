import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { useCallback } from "react";
import { warmScriptureSearchDatabase } from "../bible/scripture-database";
import { t } from "../i18n/site-copy";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { scriptureCommandSkipNext } from "../music/scriptureCommands";
import { getScripturePlayingChapter } from "../music/scripturePlayingChapterStore";
import { shellPlaybackDockChrome } from "../shell/shellPlaybackTransportLayout";
import { isReadChapterPathname } from "../shell/shellPrimaryRoute";
import { useParchmentColumnMaxWidth } from "./parchmentColumnLayout";
import { getActiveReadChapterPlayback } from "./read-chapter-playback-store";
import { resolveChapterPageScripturePlayTarget } from "./resolveChapterPageScripturePlayTarget";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { readScriptureSearchRoute } from "./readScriptureSearchRoute";
import { shouldShowReadScriptureAudioDock } from "./readScriptureDockVisibility";
import { ReadScripturePlaybackDock } from "./ReadScripturePlaybackDock";

function paramString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function resolveSearchChapterRef(): { bookId: string; chapter: number } | undefined {
  const playing = getScripturePlayingChapter();
  if (playing?.bookId && Number.isInteger(playing.chapter) && playing.chapter >= 1) {
    return { bookId: playing.bookId, chapter: playing.chapter };
  }
  const active = getActiveReadChapterPlayback();
  if (active?.bookId && Number.isInteger(active.chapter) && active.chapter >= 1) {
    return { bookId: active.bookId, chapter: active.chapter };
  }
  return undefined;
}

/** 读经章页播放坞：与计划播放页共用同一套控件。 */
export function ReadScriptureAudioDockStrip() {
  const columnMaxWidth = useParchmentColumnMaxWidth();
  const router = useRouter();
  const pathname = usePathname();
  const routeParams = useGlobalSearchParams<{ bookId?: string; chapter?: string }>();
  const { primaryTranslationId, chapterAudioTranslationId } = useReadBibleTypography();
  const {
    playing,
    playbackMode,
    readChapterAudioAvailable,
    scripturePreparing,
    playScriptureChapter,
    togglePlayScripture,
  } = useMusicPlayback();

  const show = shouldShowReadScriptureAudioDock({
    readChapterAudioAvailable,
    onChapterPage: isReadChapterPathname(pathname ?? ""),
    playbackMode,
    playing,
    scripturePreparing,
  });

  /** 搜索键：打开经文搜索（带当前章上下文）。 */
  const onOpenSearch = useCallback(() => {
    let ref = resolveSearchChapterRef();
    if (!ref && isReadChapterPathname(pathname ?? "")) {
      const bookId = paramString(routeParams.bookId);
      const chapter = Number(paramString(routeParams.chapter));
      if (bookId && Number.isInteger(chapter) && chapter >= 1) {
        ref = { bookId, chapter };
      }
    }
    router.push(readScriptureSearchRoute(ref));
    void warmScriptureSearchDatabase(primaryTranslationId);
  }, [pathname, primaryTranslationId, routeParams.bookId, routeParams.chapter, router]);

  const onNext = useCallback(() => {
    void scriptureCommandSkipNext();
  }, []);

  const onTogglePlay = useCallback(() => {
    if (playing) {
      void togglePlayScripture({ forcePause: true });
      return;
    }
    // 章页再播：按路由章显式开播，避免 browse/listen 仍钉计划池当前轨。
    if (isReadChapterPathname(pathname ?? "")) {
      const chapterNum = Number(paramString(routeParams.chapter));
      const target = resolveChapterPageScripturePlayTarget(pathname ?? "", {
        bookId: paramString(routeParams.bookId) || undefined,
        chapter: Number.isInteger(chapterNum) && chapterNum >= 1 ? chapterNum : undefined,
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
    pathname,
    playScriptureChapter,
    playing,
    routeParams.bookId,
    routeParams.chapter,
    togglePlayScripture,
  ]);

  return (
    <ReadScripturePlaybackDock
      visible={show}
      columnMaxWidth={columnMaxWidth}
      style={{ marginBottom: shellPlaybackDockChrome.marginBottom }}
      onTogglePlay={onTogglePlay}
      onNext={onNext}
      onRead={onOpenSearch}
      readIconName="search"
      readAccessibilityLabel={t("pages.read.chapterChromeSearch")}
    />
  );
}
