"use client";

import { useEffect } from "react";
import { useCuvChapterAudioVoice } from "@/components/bible/CuvChapterAudioVoiceContext";
import { scheduleReadChapterAudioPrefetch } from "@/lib/read/schedule-read-chapter-audio-prefetch";

type Args = {
  bookId: string;
  bookName: string;
  chapter: number;
  translationId: string;
};

/** 章页经文音频邻章 / planFlow 预取。 */
export function useReadChapterAudioPrefetch({
  bookId,
  bookName,
  chapter,
  translationId,
}: Args): void {
  const { effectiveVoiceId } = useCuvChapterAudioVoice();

  useEffect(() => {
    return scheduleReadChapterAudioPrefetch({
      bookId,
      bookName,
      chapter,
      translationId,
      effectiveVoiceId,
    });
  }, [bookId, bookName, chapter, effectiveVoiceId, translationId]);
}
