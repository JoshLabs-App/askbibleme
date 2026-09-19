"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CuvChapterAudioVoiceId } from "@/lib/bible/cuv-chapter-audio-voices";
import {
  fetchChapterVerseTimings,
  type CuvChapterVerseTiming,
} from "@/lib/bible/cuv-chapter-verse-timings";
import {
  splitVerseSentences,
  verseSentenceIndexAt,
  verseSentenceWeights,
  type VerseSentenceRange,
} from "@/lib/read/verse-sentences";
import { activeVerseProgressAt } from "@/lib/read/verse-timing-lookup";

type VerseLike = { verse: number; text: string };

export type ReadChapterFollow = {
  /** 当前正在读的节号；null = 没在跟读 */
  verse: number | null;
  /** 当前正在读的那一句在节正文里的字符区间（前闭后开） */
  sentence: VerseSentenceRange | null;
};

const IDLE: ReadChapterFollow = { verse: null, sentence: null };

/**
 * 播经跟读高亮：当前读到哪一节的哪一句。
 *
 * 这个功能曾被整个摘掉（「易错位、跟读态抬重渲染」），2026-09-19 重开，两个老毛病这么绕开：
 * - **错位**：`buildChapterVerseTimingsCandidates` 认不出的译本直接没有时间轴 URL，
 *   拿不到就不高亮（Josh 2026-09-11 定的「没有时间点就不高亮」）。
 * - **重渲染**：句切分表 `useMemo` 切一次缓存住；派生只做二分 + 累加，
 *   而且结果先收敛成一个字符串 key，key 不变就不产生新的 state。
 *   `ReadChapterVersesClient` 本来就订阅了播放上下文，这里不额外多一次订阅。
 */
export function useReadChapterFollowSentence(args: {
  enabled: boolean;
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  bookId: string;
  chapter: number;
  verses: readonly VerseLike[];
  currentSec: number;
}): ReadChapterFollow {
  const { enabled, translationId, voiceId, bookId, chapter, verses, currentSec } = args;
  const [timings, setTimings] = useState<CuvChapterVerseTiming[] | null>(null);

  useEffect(() => {
    if (!enabled) {
      setTimings(null);
      return;
    }
    let cancelled = false;
    void fetchChapterVerseTimings(translationId, voiceId, bookId, chapter).then((rows) => {
      if (!cancelled) setTimings(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [bookId, chapter, enabled, translationId, voiceId]);

  // 整章切一次句，缓存住；下面的派生会被每次 timeupdate 调到
  const sentenceIndex = useMemo(() => {
    const out = new Map<number, { ranges: VerseSentenceRange[]; weights: number[] }>();
    for (const v of verses) {
      const text = v?.text ?? "";
      if (!text) continue;
      const ranges = splitVerseSentences(text);
      if (!ranges.length) continue;
      out.set(v.verse, { ranges, weights: verseSentenceWeights(text, ranges) });
    }
    return out;
  }, [verses]);

  const key = (() => {
    if (!enabled || !timings?.length) return "";
    const hit = activeVerseProgressAt(currentSec, timings);
    if (!hit) return "";
    const entry = sentenceIndex.get(hit.verse);
    if (!entry) return "";
    return `${hit.verse}:${verseSentenceIndexAt(hit.progress, entry.weights)}`;
  })();

  // key 不变就返回上一次的对象：下游 memo / props 比较才跳得过
  const lastRef = useRef<{ key: string; value: ReadChapterFollow }>({ key: "", value: IDLE });
  if (lastRef.current.key !== key) {
    if (!key) {
      lastRef.current = { key, value: IDLE };
    } else {
      const [rawVerse, rawSentence] = key.split(":");
      const verse = Number(rawVerse);
      lastRef.current = {
        key,
        value: {
          verse,
          sentence: sentenceIndex.get(verse)?.ranges[Number(rawSentence)] ?? null,
        },
      };
    }
  }
  return lastRef.current.value;
}
