import * as Haptics from "expo-haptics";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import type { ScrollView } from "react-native";
import type { LoadedChapter } from "../bible/types";
import { deferChapterPickerNavigation } from "./BibleChapterPickerPanel";
import { setReadChapterBottomChromeApi } from "./read-chapter-chrome-inset";
import { jumpReadChapter, navigateReadChapter, type ReadChapterNavDirection } from "./read-chapter-nav";
import {
  pushReadPlanFlowChapter,
  replaceReadPlanFlowChapterAudio,
  resolvePlanFlowNextTarget,
  type PlanChapterRef,
} from "./read-plan-flow-nav";
import {
  armReadPlanFlowAutoplay,
  beginPlanFlowChapterAdvance,
  endPlanFlowChapterAdvanceDeferred,
} from "./read-plan-flow-autoplay";
import { ensurePlanFlowChapterAudioReady } from "./prefetch-plan-flow-chapter-audio";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import type { TodayReadingPlanPayload } from "./reading-plan/today-reading-plan-payload";
import { markTodayReadingAudioChapterComplete } from "./reading-plan/today-reading-done";
import { useShellSwipeAction } from "../shell/useShellSwipeAction";
import { useShellSwipeSuspend } from "../shell/useShellSwipeSuspend";
import type { HighlightWordEditorTarget } from "./ReadVerseHighlightWordSheet";
import type { VerseActionMenuState } from "./readChapterScreenConstants";

type NeighborTarget = { bookId: string; chapter: number } | null;

type ChapterScreenNavigation = {
  isFocused: () => boolean;
  addListener: NavigationProp<ParamListBase>["addListener"];
  getState: NavigationProp<ParamListBase>["getState"];
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

  const onAdvanceChapterAudio = useCallback(
    (next: { bookId: string; chapter: number } | null) => {
      if (isPlanFlow) {
        void (async () => {
          if (chapterData) {
            void markTodayReadingAudioChapterComplete(chapterData.bookId, chapterData.chapter);
          }
          const target =
            planFlowNextTarget ??
            (chapterData
              ? resolvePlanFlowNextTarget(todayPlanPayload, chapterData.bookId, chapterData.chapter)
              : null);
          if (!target) return;
          beginPlanFlowChapterAdvance();
          try {
            armReadPlanFlowAutoplay();
            await ensurePlanFlowChapterAudioReady({
              ref: target,
              translationId: chapterAudioTranslationId,
              voiceId: audioVoiceId,
            });
            const sameChapter =
              chapterData != null &&
              target.bookId === chapterData.bookId &&
              target.chapter === chapterData.chapter;
            replaceReadPlanFlowChapterAudio(
              router,
              target,
              sameChapter ? Date.now() : undefined,
            );
          } finally {
            endPlanFlowChapterAdvanceDeferred();
          }
        })();
        return;
      }
      if (!next) return;
      goNeighbor(next, "forward");
    },
    [
      audioVoiceId,
      chapterAudioTranslationId,
      chapterData,
      goNeighbor,
      isPlanFlow,
      planFlowNextTarget,
      router,
      todayPlanPayload,
    ],
  );

  const onChapterSwipe = useCallback(
    (direction: "left" | "right") => {
      // 阅读序：左划下一章（新页从右进），右划上一章（新页从左进）；与首页场景条左右空间模型相反
      if (direction === "left") {
        if (isPlanFlow && planFlowNextTarget) {
          pushReadPlanFlowChapter(router, planFlowNextTarget);
          return;
        }
        goNeighbor(neighbors.next, "forward");
        return;
      }
      if (isPlanFlow && planFlowPrevTarget) {
        pushReadPlanFlowChapter(router, planFlowPrevTarget);
        return;
      }
      goNeighbor(neighbors.prev, "back");
    },
    [goNeighbor, isPlanFlow, neighbors.next, neighbors.prev, planFlowNextTarget, planFlowPrevTarget, router],
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
    const show = () => setJumpPickerBookId(book.bookId);
    if (Platform.OS === "android") {
      setTimeout(show, 120);
      return;
    }
    show();
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
    if (isPlanFlow && planFlowNextTarget) {
      pushReadPlanFlowChapter(router, planFlowNextTarget);
      return;
    }
    goNeighbor(neighbors.next, "forward");
  }, [goNeighbor, isPlanFlow, neighbors.next, planFlowNextTarget, router]);

  const goPrevChrome = useCallback(() => {
    if (isPlanFlow && planFlowPrevTarget) {
      pushReadPlanFlowChapter(router, planFlowPrevTarget);
      return;
    }
    goNeighbor(neighbors.prev, "back");
  }, [goNeighbor, isPlanFlow, neighbors.prev, planFlowPrevTarget, router]);

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
