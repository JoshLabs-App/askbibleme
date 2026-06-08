import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ScrollView } from "react-native";
import {
  chapterAudioVerseSyncTranslationId,
  fetchChapterVerseTimings,
  verseIndexForVerseNumber,
  verseNumberAtChapterAudioTime,
  type CuvChapterVerseTiming,
} from "../bible/cuv-chapter-verse-timings";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import {
  buildChapterAudioPlayableSrcSync,
  translationSupportsChapterAudio,
} from "../bible/read-chapter-audio";
import {
  verseIndexForReadChapterAudioTime,
  verseWeightsForReadChapterAudio,
} from "../bible/read-chapter-audio-verse-from-progress";
import type { LoadedChapter } from "../bible/types";
import { getChapterAudioBaseUrl } from "../bible/chapter-audio-url";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import {
  resolveReadChapterAudioRegistration,
  useMusicPlayback,
} from "../music/MusicPlaybackContext";
import { getNextScriptureChapterInBook } from "../bible/next-scripture-chapter";
import { resolveReadChapterNeighbors } from "../bible/read-chapter-neighbors";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";

type ChapterTarget = { bookId: string; chapter: number };
type VerseLayout = { y: number; height: number };

export function useReadChapterAudio(
  chapterData: LoadedChapter | null,
  scrollRef: React.RefObject<ScrollView | null>,
  scrollHeaderHeightRef?: React.RefObject<number>,
  onAdvanceChapter?: (target: ChapterTarget) => void,
  verseLayoutsRef?: React.RefObject<Map<number, VerseLayout>>,
  scrollViewportHeight?: number,
) {
  const {
    registerReadChapter,
    playing,
    playbackMode,
    scriptureCurrentSec,
    scriptureDurationSec,
  } = useMusicPlayback();
  const registerReadChapterRef = useRef(registerReadChapter);
  registerReadChapterRef.current = registerReadChapter;

  const [chapterAudioSrc, setChapterAudioSrc] = useState<string | null>(null);
  const [verseTimings, setVerseTimings] = useState<CuvChapterVerseTiming[] | null>(null);
  const [weightVerses, setWeightVerses] = useState<readonly { text: string }[] | null>(null);
  const lastFollowIndexRef = useRef<number | null>(null);
  const onAdvanceChapterRef = useRef(onAdvanceChapter);
  onAdvanceChapterRef.current = onAdvanceChapter;
  const baseUrl = useMemo(() => getAskBibleBaseUrl(), []);
  const { audioVoiceId, chapterAudioTranslationId } = useReadBibleTypography();
  const isFocused = useIsFocused();

  const supported = chapterData ? translationSupportsChapterAudio(chapterAudioTranslationId) : false;
  const verseSyncTranslationId = useMemo(
    () => chapterAudioVerseSyncTranslationId(chapterAudioTranslationId, audioVoiceId),
    [audioVoiceId, chapterAudioTranslationId],
  );

  const chapterAudioKey = useMemo(() => {
    if (!chapterData) return null;
    return `${chapterData.bookId}:${chapterData.chapter}:${chapterAudioTranslationId}:${audioVoiceId}`;
  }, [chapterData, chapterAudioTranslationId, audioVoiceId]);

  useEffect(() => {
    return () => {
      registerReadChapterRef.current(null);
    };
  }, []);

  useEffect(() => {
    if (!chapterData || !chapterAudioKey || !isFocused) {
      if (!chapterData || !chapterAudioKey) {
        registerReadChapterRef.current(null);
        setChapterAudioSrc(null);
      }
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
      if (!next) return;
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

    return () => {
      cancelled = true;
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
    isFocused,
  ]);

  useEffect(() => {
    if (!chapterData || !supported) {
      setVerseTimings(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const timings = await fetchChapterVerseTimings(
        baseUrl,
        chapterAudioTranslationId,
        audioVoiceId,
        chapterData.bookId,
        chapterData.chapter,
      );
      if (!cancelled) setVerseTimings(timings);
    })();
    return () => {
      cancelled = true;
    };
  }, [audioVoiceId, baseUrl, chapterAudioTranslationId, chapterData, supported, verseSyncTranslationId]);

  useEffect(() => {
    if (!chapterData || !supported) {
      setWeightVerses(null);
      return;
    }
    if (verseSyncTranslationId === chapterData.translationId) {
      setWeightVerses(chapterData.verses);
      return;
    }
    let cancelled = false;
    void loadChapterFromBundledTranslation(
      chapterData.bookId,
      chapterData.chapter,
      verseSyncTranslationId,
    ).then((loaded) => {
      if (cancelled) return;
      setWeightVerses(loaded?.verses ?? chapterData.verses);
    });
    return () => {
      cancelled = true;
    };
  }, [
    chapterData,
    chapterData?.bookId,
    chapterData?.chapter,
    chapterData?.translationId,
    chapterData?.verses,
    supported,
    verseSyncTranslationId,
  ]);

  const weights = useMemo(
    () => (weightVerses ? verseWeightsForReadChapterAudio(weightVerses) : []),
    [weightVerses],
  );

  const audioMatchesChapter =
    supported && Boolean(chapterAudioSrc) && playbackMode === "scripture" && playing;
  const scriptureBoundToCurrentChapter =
    supported && Boolean(chapterAudioSrc) && playbackMode === "scripture";
  const nearAudioEnd =
    scriptureBoundToCurrentChapter &&
    scriptureDurationSec > 0 &&
    scriptureCurrentSec >= Math.max(0, scriptureDurationSec - 1.2);

  const activeVerseIndex = (() => {
    if (!chapterData || !audioMatchesChapter) return null;
    if (verseTimings?.length) {
      const verseNum = verseNumberAtChapterAudioTime(scriptureCurrentSec, verseTimings);
      if (verseNum === null) return null;
      return verseIndexForVerseNumber(chapterData.verses, verseNum);
    }
    return verseIndexForReadChapterAudioTime(
      scriptureCurrentSec,
      scriptureDurationSec,
      weights,
    );
  })();

  useEffect(() => {
    if (activeVerseIndex === null) {
      lastFollowIndexRef.current = null;
      return;
    }
    if (lastFollowIndexRef.current === activeVerseIndex) return;
    lastFollowIndexRef.current = activeVerseIndex;
    const verseNum = chapterData?.verses?.[activeVerseIndex]?.verse ?? null;
    const layout = verseNum != null ? verseLayoutsRef?.current?.get(verseNum) : null;
    if (layout && scrollViewportHeight && scrollViewportHeight > 0) {
      // Keep highlighted verse centered in the primary reading area.
      const focusY = layout.y + layout.height / 2 - scrollViewportHeight / 2;
      scrollRef.current?.scrollTo({ y: Math.max(0, focusY), animated: true });
      return;
    }
    const headerY = scrollHeaderHeightRef?.current ?? 0;
    scrollRef.current?.scrollTo({
      y: Math.max(0, headerY + activeVerseIndex * 44 - 120),
      animated: true,
    });
  }, [
    activeVerseIndex,
    chapterData?.verses,
    scrollRef,
    scrollHeaderHeightRef,
    scrollViewportHeight,
    verseLayoutsRef,
  ]);

  return {
    supported,
    chapterAudioAvailable: Boolean(chapterAudioSrc),
    activeVerseIndex,
    audioMatchesChapter,
    nearAudioEnd,
  };
}
