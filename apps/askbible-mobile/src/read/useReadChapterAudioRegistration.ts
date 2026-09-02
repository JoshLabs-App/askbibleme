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
  shouldHoldPlanFlowChapterUnregister,
} from "./read-plan-flow-autoplay";
import { scriptureChapterPool } from "../music/scripture-chapter-pool";
import {
  scriptureCommandSkipNext,
  scriptureCommandSkipPrev,
} from "../music/scriptureCommands";

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
    // isActive() 只说明「有个池在跑」，不说明这个池跑的就是本章——用户直接打开某个
    // 计划章（isPlanFlow=true）时，若上一次计划会话留下的池还 active 但当前轨是
    // 别的章，无脑信 isActive() 会把换章代理给一个跟本章无关的池（scriptureCommandSkipNext
    // 内部也会再判一次 match，两边若只有一边查 match 会出现「查了也没用」的递归/错代）。
    const poolMatchesThisChapter = () => {
      const track = scriptureChapterPool.getCurrentTrack();
      return (
        scriptureChapterPool.isActive() &&
        !!track &&
        track.bookId === snapshot.bookId &&
        track.chapter === snapshot.chapter &&
        track.translationId === chapterAudioTranslationId
      );
    };
    reg.onAdvancePreviousChapter = () => {
      if (isPlanFlow && poolMatchesThisChapter()) {
        void scriptureCommandSkipPrev();
        return;
      }
      const { prev } = resolveReadChapterNeighbors(snapshot.bookId, snapshot.chapter);
      if (!prev) return;
      onAdvanceChapterRef.current?.(prev);
    };
    reg.onAdvanceNextChapter = () => {
      if (isPlanFlow && poolMatchesThisChapter()) {
        void scriptureCommandSkipNext();
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
        // 不在每次 register 时重新 arm：暂停后回到章页会误自动开播。
        // 续章开播由 playChapterAt / handoff / 显式 arm 负责。
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
