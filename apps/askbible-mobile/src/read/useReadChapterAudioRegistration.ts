import { useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import { getChapterAudioBaseUrl } from "../bible/chapter-audio-url";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { buildChapterAudioPlayableSrcSync } from "../bible/read-chapter-audio";
import { getNextScriptureChapterInBook } from "../bible/next-scripture-chapter";
import { resolveReadChapterNeighbors } from "../bible/read-chapter-neighbors";
import type { LoadedChapter } from "../bible/types";
import { resolveReadChapterAudioRegistration } from "../music/MusicPlaybackContext";
import {
  armReadPlanFlowAutoplay,
  isPlanFlowSessionActive,
  shouldHoldPlanFlowChapterUnregister,
} from "./read-plan-flow-autoplay";
import { scriptureChapterPool } from "../music/scripture-chapter-pool";

type ChapterTarget = { bookId: string; chapter: number };

type Args = {
  chapterData: LoadedChapter | null;
  chapterAudioKey: string | null;
  chapterAudioTranslationId: string;
  audioVoiceId: CuvChapterAudioVoiceId;
  isPlanFlow?: boolean;
  planFlowTick?: string | null;
  registerReadChapterRef: React.MutableRefObject<
    (reg: Awaited<ReturnType<typeof resolveReadChapterAudioRegistration>> | null) => void
  >;
  onAdvanceChapter?: (target: ChapterTarget | null) => void;
};

export function useReadChapterAudioRegistration({
  chapterData,
  chapterAudioKey,
  chapterAudioTranslationId,
  audioVoiceId,
  isPlanFlow = false,
  planFlowTick,
  registerReadChapterRef,
  onAdvanceChapter,
}: Args) {
  const [chapterAudioSrc, setChapterAudioSrc] = useState<string | null>(null);
  const onAdvanceChapterRef = useRef(onAdvanceChapter);
  onAdvanceChapterRef.current = onAdvanceChapter;

  useEffect(() => {
    return () => {
      if (
        isPlanFlow &&
        (shouldHoldPlanFlowChapterUnregister() ||
          scriptureChapterPool.shouldPreservePlaybackOnUIUnmount())
      ) {
        return;
      }
      registerReadChapterRef.current(null);
    };
  }, [isPlanFlow, registerReadChapterRef]);

  useEffect(() => {
    if (!chapterData || !chapterAudioKey) {
      if (
        isPlanFlow &&
        (shouldHoldPlanFlowChapterUnregister() ||
          scriptureChapterPool.shouldPreservePlaybackOnUIUnmount())
      ) {
        return;
      }
      registerReadChapterRef.current(null);
      setChapterAudioSrc(null);
      return;
    }

    const snapshot = chapterData;
    const syncSrc = buildChapterAudioPlayableSrcSync({
      baseUrl: getChapterAudioBaseUrl(),
      translationId: chapterAudioTranslationId,
      bookId: snapshot.bookId,
      chapter: snapshot.chapter,
      bookName: snapshot.bookName,
      voiceId: audioVoiceId,
    });
    const reg = {
      bookId: snapshot.bookId,
      chapter: snapshot.chapter,
      bookName: snapshot.bookName,
      translationId: chapterAudioTranslationId,
      chapterAudioSrc: syncSrc,
      onAdvancePreviousChapter: () => {},
      onAdvanceNextChapter: () => {},
      onAdvanceNextInBook: () => {},
    };
    reg.onAdvancePreviousChapter = () => {
      const { prev } = resolveReadChapterNeighbors(snapshot.bookId, snapshot.chapter);
      if (!prev) return;
      onAdvanceChapterRef.current?.(prev);
    };
    reg.onAdvanceNextChapter = () => {
      if (isPlanFlow && scriptureChapterPool.isActive()) {
        void scriptureChapterPool.skipToNext();
        return;
      }
      const { next } = resolveReadChapterNeighbors(snapshot.bookId, snapshot.chapter);
      onAdvanceChapterRef.current?.(next);
    };
    reg.onAdvanceNextInBook = () => {
      const next = getNextScriptureChapterInBook(snapshot.bookId, snapshot.chapter);
      if (!next) return;
      onAdvanceChapterRef.current?.(next);
    };

    setChapterAudioSrc(reg.chapterAudioSrc);
    registerReadChapterRef.current(reg);

    let cancelled = false;
    const resolveTask = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        const resolved = await resolveReadChapterAudioRegistration({
          bookId: snapshot.bookId,
          chapter: snapshot.chapter,
          bookName: snapshot.bookName,
          translationId: chapterAudioTranslationId,
          voiceId: audioVoiceId,
          onAdvancePreviousChapter: reg.onAdvancePreviousChapter,
          onAdvanceNextChapter: reg.onAdvanceNextChapter,
          onAdvanceNextInBook: reg.onAdvanceNextInBook,
        });
        if (cancelled) return;
        setChapterAudioSrc(resolved.chapterAudioSrc);
        if (isPlanFlow && isPlanFlowSessionActive() && !scriptureChapterPool.isActive()) {
          armReadPlanFlowAutoplay();
        }
        registerReadChapterRef.current(resolved);
      })();
    });

    return () => {
      cancelled = true;
      resolveTask.cancel();
      if (isPlanFlow && shouldHoldPlanFlowChapterUnregister()) {
        return;
      }
      if (scriptureChapterPool.shouldPreservePlaybackOnUIUnmount()) {
        return;
      }
      registerReadChapterRef.current(null);
    };
  }, [
    chapterAudioKey,
    audioVoiceId,
    chapterData?.bookId,
    chapterData?.chapter,
    chapterAudioTranslationId,
    chapterData?.bookName,
    isPlanFlow,
    planFlowTick,
    registerReadChapterRef,
  ]);

  return { chapterAudioSrc };
}
