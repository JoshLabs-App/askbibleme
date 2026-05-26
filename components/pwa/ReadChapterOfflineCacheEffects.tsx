"use client";

import { useEffect } from "react";
import { useCuvChapterAudioVoice } from "@/components/bible/CuvChapterAudioVoiceContext";
import { prefetchNextReadChapterAssetsIdle } from "@/lib/pwa/prefetch-read-chapter-assets";
import { writeReadChapterOfflineSnapshot } from "@/lib/pwa/read-chapter-offline-cache";

type Verse = { verse: number; text: string };

type Props = {
  translationId: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verses: Verse[];
  contrastVerses?: Verse[] | null;
};

/** 访问经文章后无感写入 IndexedDB；空闲预取下一章静态资源。 */
export function ReadChapterOfflineCacheEffects({
  translationId,
  bookId,
  bookName,
  chapter,
  verses,
  contrastVerses = null,
}: Props) {
  const { effectiveVoiceId } = useCuvChapterAudioVoice();
  const voiceId = effectiveVoiceId(bookId);

  useEffect(() => {
    if (!verses.length) return;
    void writeReadChapterOfflineSnapshot({
      translationId,
      bookId,
      chapter,
      bookName,
      verses,
      contrastVerses: contrastVerses?.length ? contrastVerses : null,
    });
  }, [translationId, bookId, bookName, chapter, verses, contrastVerses]);

  useEffect(() => {
    prefetchNextReadChapterAssetsIdle({
      bookId,
      bookName,
      chapter,
      translationId,
      voiceId,
    });
  }, [bookId, bookName, chapter, translationId, voiceId]);

  return null;
}
