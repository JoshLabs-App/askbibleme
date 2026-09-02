import * as Haptics from "expo-haptics";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import type { ScrollView } from "react-native";
import type { LoadedChapter } from "../bible/types";
import { deferAfterRowPress, deferChapterPickerNavigation } from "./BibleChapterPickerPanel";
import { setReadChapterBottomChromeApi } from "./read-chapter-chrome-inset";
import { jumpReadChapter, navigateReadChapter, type ReadChapterNavDirection } from "./read-chapter-nav";
import {
  pushReadPlanFlowChapter,
  type PlanChapterRef,
} from "./read-plan-flow-nav";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import type { TodayReadingPlanPayload } from "./reading-plan/today-reading-plan-payload";
import { kickReadChapterScriptureAfterNavigate } from "./advance-read-chapter-scripture-audio";
import { scriptureCommandSkipNext, scriptureCommandSkipPrev } from "../music/scriptureCommands";
import { scriptureChapterPool } from "../music/scripture-chapter-pool";
import { getMusicPlaybackControlSnapshot } from "../music/MusicPlaybackContext";
import { getPlayingReadChapterPlayback } from "./read-chapter-playback-store";
import { registerReadChapterNavigate } from "./read-chapter-navigate-registry";
import { useShellSwipeAction } from "../shell/useShellSwipeAction";
import { useShellSwipeSuspend } from "../shell/useShellSwipeSuspend";
import type { HighlightWordEditorTarget } from "./ReadVerseHighlightWordSheet";
import type { VerseActionMenuState } from "./readChapterScreenConstants";
import type { NavState } from "./read-chapter-nav";

type NeighborTarget = { bookId: string; chapter: number } | null;

type ChapterScreenNavigation = {
  isFocused: () => boolean;
  addListener: NavigationProp<ParamListBase>["addListener"];
  getState: () => NavState | undefined;
};

type Args = {
  chapterData: LoadedChapter | null;
  navigation: ChapterScreenNavigation;
  scrollRef: React.RefObject<ScrollView | null>;
  isPlanFlow: boolean;
  planFlowNextTarget: PlanChapterRef | null;
  planFlowPrevTarget: PlanChapterRef | null;
  todayPlanPayload: TodayReadingPlanPayload | null;
  chapterAudioTranslationId: string;
  audioVoiceId: CuvChapterAudioVoiceId;
  playScriptureChapter: (args: {
    bookId: string;
    chapter: number;
    bookName: string;
    translationId: string;
  }) => Promise<boolean>;
  neighbors: { prev: NeighborTarget; next: NeighborTarget };
  verseSelectionMode: boolean;
  verseActionMenu: VerseActionMenuState | null;
  highlightWordEditor: HighlightWordEditorTarget | null;
};

export function useReadChapterScreenNav({
  chapterData,
  navigation,
  scrollRef,
  isPlanFlow,
  planFlowNextTarget,
  planFlowPrevTarget,
  todayPlanPayload,
  chapterAudioTranslationId,
  audioVoiceId,
  playScriptureChapter,
  neighbors,
  verseSelectionMode,
  verseActionMenu,
  highlightWordEditor,
}: Args) {
  const router = useRouter();
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpPickerBookId, setJumpPickerBookId] = useState<string | null>(null);

  const goNeighbor = useCallback(
    (target: NeighborTarget, direction: ReadChapterNavDirection) => {
      if (!target || !chapterData) return;
      if (target.bookId === chapterData.bookId && target.chapter === chapterData.chapter) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigateReadChapter(router, target, direction, {
        getNavigationState: () => navigation.getState(),
      });
    },
    [chapterData, navigation, router],
  );

  // 供 scripturePlayChapterAt.ts 的 buildReadChapterAdvanceHandlers fallback handler
  // 调用：音频起播早于本章页在 ctx.readChapterRef 认领自己那个窗口期里，若不把
  // goNeighbor 暴露出去，音频侧只会推进播放、不会带着这个页面一起换章。非计划流
  // 才注册——计划流有 PlanFlowPlaybackBridge 自己的 navigateToChapter，两边都注册
  // 会重复导航。
  useEffect(() => {
    if (isPlanFlow) return;
    registerReadChapterNavigate(goNeighbor);
    return () => registerReadChapterNavigate(null);
  }, [goNeighbor, isPlanFlow]);

  // 用户手动划/点下一章时，若正在听的就是本章音频，随文字一起换章续播（从头播），
  // 对齐 onAdvanceChapterAudio（章末自然续章）的行为；不在听就只翻页，不无端开播。
  const isActivelyPlayingThisChapter = useCallback((): boolean => {
    if (!chapterData) return false;
    const snap = getMusicPlaybackControlSnapshot();
    if (snap.playbackMode !== "scripture" || !snap.playing) return false;
    const playing = getPlayingReadChapterPlayback();
    return (
      !!playing &&
      playing.bookId === chapterData.bookId &&
      playing.chapter === chapterData.chapter
    );
  }, [chapterData]);

  const onAdvanceChapterAudio = useCallback(
    (next: { bookId: string; chapter: number } | null) => {
      // isPlanFlow 不等于「池当前轨就是本章」：若不匹配（残留的别的计划会话），
      // 无脑丢给 scriptureCommandSkipNext 会被它的池匹配检查打回本函数（同一个
      // next），造成死循环；因此这里要用 next 直接顺章，不能只看 isPlanFlow。
      const track = scriptureChapterPool.getCurrentTrack();
      const poolMatchesThisChapter =
        chapterData != null &&
        scriptureChapterPool.isActive() &&
        !!track &&
        track.bookId === chapterData.bookId &&
        track.chapter === chapterData.chapter &&
        track.translationId === chapterAudioTranslationId;
      if (isPlanFlow && poolMatchesThisChapter) {
        void scriptureCommandSkipNext();
        return;
      }
      if (!next) return;
      goNeighbor(next, "forward");
      void kickReadChapterScriptureAfterNavigate(
        playScriptureChapter,
        next,
        chapterAudioTranslationId,
      );
    },
    [
      chapterAudioTranslationId,
      chapterData,
      goNeighbor,
      isPlanFlow,
      playScriptureChapter,
    ],
  );

  const onChapterSwipe = useCallback(
    (direction: "left" | "right") => {
      // 阅读序：左划下一章（新页从右进），右划上一章（新页从左进）；与首页场景条左右空间模型相反
      if (direction === "left") {
        // 计划内且正在听本章：交给池处理（池会自己 navigateToChapter，音频/文字/
        // 起播位置由它统一负责），不再只 push 路由而不管音频——否则文字换了，
        // 池的音轨索引没跟着换，后续章末续播/坞键会继续对着旧索引走。
        if (isPlanFlow && planFlowNextTarget && isActivelyPlayingThisChapter()) {
          void scriptureCommandSkipNext();
          return;
        }
        if (isPlanFlow && planFlowNextTarget) {
          pushReadPlanFlowChapter(router, planFlowNextTarget);
          return;
        }
        goNeighbor(neighbors.next, "forward");
        if (isActivelyPlayingThisChapter() && neighbors.next) {
          void kickReadChapterScriptureAfterNavigate(
            playScriptureChapter,
            neighbors.next,
            chapterAudioTranslationId,
          );
        }
        return;
      }
      if (isPlanFlow && planFlowPrevTarget && isActivelyPlayingThisChapter()) {
        void scriptureCommandSkipPrev();
        return;
      }
      if (isPlanFlow && planFlowPrevTarget) {
        pushReadPlanFlowChapter(router, planFlowPrevTarget);
        return;
      }
      goNeighbor(neighbors.prev, "back");
      if (isActivelyPlayingThisChapter() && neighbors.prev) {
        void kickReadChapterScriptureAfterNavigate(
          playScriptureChapter,
          neighbors.prev,
          chapterAudioTranslationId,
        );
      }
    },
    [
      chapterAudioTranslationId,
      goNeighbor,
      isActivelyPlayingThisChapter,
      isPlanFlow,
      neighbors.next,
      neighbors.prev,
      planFlowNextTarget,
      planFlowPrevTarget,
      playScriptureChapter,
      router,
    ],
  );

  useShellSwipeAction(
    Boolean(chapterData) &&
      !jumpOpen &&
      !verseSelectionMode &&
      verseActionMenu == null &&
      !highlightWordEditor,
    onChapterSwipe,
  );
  useShellSwipeSuspend(
    jumpOpen || verseSelectionMode || verseActionMenu != null || highlightWordEditor != null,
  );

  const jumpToChapter = useCallback(
    (nextBookId: string, nextChapter: number) => {
      setJumpOpen(false);
      setJumpPickerBookId(null);
      deferChapterPickerNavigation(() => {
        jumpReadChapter(router, { bookId: nextBookId, chapter: nextChapter });
      });
    },
    [router],
  );

  const openCatalogChrome = useCallback(() => {
    setJumpOpen(true);
  }, []);

  const onJumpBookPress = useCallback((book: { bookId: string }) => {
    deferAfterRowPress(() => setJumpPickerBookId(book.bookId));
  }, []);

  useEffect(() => {
    if (!jumpOpen) setJumpPickerBookId(null);
  }, [jumpOpen]);

  const goReadHomeFromCatalog = useCallback(() => {
    setJumpOpen(false);
    router.push("/read");
  }, [router]);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollRef]);

  const goNextChrome = useCallback(() => {
    if (isPlanFlow && planFlowNextTarget && isActivelyPlayingThisChapter()) {
      void scriptureCommandSkipNext();
      return;
    }
    if (isPlanFlow && planFlowNextTarget) {
      pushReadPlanFlowChapter(router, planFlowNextTarget);
      return;
    }
    goNeighbor(neighbors.next, "forward");
    if (isActivelyPlayingThisChapter() && neighbors.next) {
      void kickReadChapterScriptureAfterNavigate(
        playScriptureChapter,
        neighbors.next,
        chapterAudioTranslationId,
      );
    }
  }, [
    chapterAudioTranslationId,
    goNeighbor,
    isActivelyPlayingThisChapter,
    isPlanFlow,
    neighbors.next,
    planFlowNextTarget,
    playScriptureChapter,
    router,
  ]);

  const goPrevChrome = useCallback(() => {
    if (isPlanFlow && planFlowPrevTarget && isActivelyPlayingThisChapter()) {
      void scriptureCommandSkipPrev();
      return;
    }
    if (isPlanFlow && planFlowPrevTarget) {
      pushReadPlanFlowChapter(router, planFlowPrevTarget);
      return;
    }
    goNeighbor(neighbors.prev, "back");
    if (isActivelyPlayingThisChapter() && neighbors.prev) {
      void kickReadChapterScriptureAfterNavigate(
        playScriptureChapter,
        neighbors.prev,
        chapterAudioTranslationId,
      );
    }
  }, [
    chapterAudioTranslationId,
    goNeighbor,
    isActivelyPlayingThisChapter,
    isPlanFlow,
    neighbors.prev,
    planFlowPrevTarget,
    playScriptureChapter,
    router,
  ]);

  const chapterHasNext = isPlanFlow ? Boolean(planFlowNextTarget) : Boolean(neighbors.next);

  useEffect(() => {
    const syncChrome = () => {
      if (!navigation.isFocused() || !chapterData) {
        setReadChapterBottomChromeApi(null);
        return;
      }
      setReadChapterBottomChromeApi({
        openCatalog: openCatalogChrome,
        goNext: goNextChrome,
        hasNext: chapterHasNext,
      });
    };

    syncChrome();
    const onFocus = navigation.addListener("focus", syncChrome);
    const onBlur = navigation.addListener("blur", () => {
      setReadChapterBottomChromeApi(null);
    });
    return () => {
      onFocus();
      onBlur();
      setReadChapterBottomChromeApi(null);
    };
  }, [
    chapterData,
    goNextChrome,
    navigation,
    chapterHasNext,
    openCatalogChrome,
  ]);

  return {
    onAdvanceChapterAudio,
    jumpOpen,
    setJumpOpen,
    jumpPickerBookId,
    setJumpPickerBookId,
    jumpToChapter,
    onJumpBookPress,
    goReadHomeFromCatalog,
    scrollToTop,
    goNextChrome,
    goPrevChrome,
  };
}
