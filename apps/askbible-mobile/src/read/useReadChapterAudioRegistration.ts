import { useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import { getChapterAudioBaseUrl } from "../bible/chapter-audio-url";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { buildChapterAudioPlayableSrcSync } from "../bible/read-chapter-audio";
import { getNextScriptureChapterInBook } from "../bible/next-scripture-chapter";
import { resolveReadChapterNeighbors } from "../bible/read-chapter-neighbors";
import type { LoadedChapter } from "../bible/types";
import { resolveReadChapterAudioRegistration } from "../music/MusicPlaybackContext";

type ChapterTarget = { bookId: string; chapter: number };

type Args = {
  chapterData: LoadedChapter | null;
  chapterAudioKey: string | null;
  chapterAudioTranslationId: string;
  audioVoiceId: CuvChapterAudioVoiceId;
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
  planFlowTick,
  registerReadChapterRef,
  onAdvanceChapter,
}: Args) {
  const [chapterAudioSrc, setChapterAudioSrc] = useState<string | null>(null);
  const onAdvanceChapterRef = useRef(onAdvanceChapter);
  onAdvanceChapterRef.current = onAdvanceChapter;

  useEffect(() => {
    return () => {
      registerReadChapterRef.current(null);
    };
  }, [registerReadChapterRef]);

  useEffect(() => {
    if (!chapterData || !chapterAudioKey) {
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
      onAdvanceNextChapter: () => {},
      onAdvanceNextInBook: () => {},
    };
    reg.onAdvanceNextChapter = () => {
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
          onAdvanceNextChapter: reg.onAdvanceNextChapter,
          onAdvanceNextInBook: reg.onAdvanceNextInBook,
        });
        if (cancelled) return;
        setChapterAudioSrc(resolved.chapterAudioSrc);
        registerReadChapterRef.current(resolved);
      })();
    });

    return () => {
      cancelled = true;
      resolveTask.cancel();
      // 章节、语音或聚焦状态变化时，先注销旧章节，避免音频继续播上一章却用新章节正文高亮。
      registerReadChapterRef.current(null);
    };
  }, [
    chapterAudioKey,
    audioVoiceId,
    chapterData?.bookId,
    chapterData?.chapter,
    chapterAudioTranslationId,
    chapterData?.bookName,
    planFlowTick,
    registerReadChapterRef,
  ]);

  return { chapterAudioSrc };
}
