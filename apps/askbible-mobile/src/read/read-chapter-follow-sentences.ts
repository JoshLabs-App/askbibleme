import type { LoadedChapterVerse } from "../bible/types";
import {
  splitVerseSentences,
  verseSentenceWeights,
  type VerseSentenceRange,
} from "./verse-sentences";

export type VerseSentenceIndex = {
  ranges: VerseSentenceRange[];
  weights: number[];
};

/**
 * 整章的句切分表：节号 → 句区间 + 权重。
 *
 * 播放秒数每 120ms 推一次，跟读派生函数会被高频调用 —— 句切分必须在这里切一次缓存住，
 * 不能放进派生函数里每次重切。
 */
export function buildChapterSentenceIndex(
  verses: readonly LoadedChapterVerse[] | null | undefined,
): Map<number, VerseSentenceIndex> {
  const out = new Map<number, VerseSentenceIndex>();
  for (const v of verses ?? []) {
    const text = v?.text ?? "";
    if (!text) continue;
    const ranges = splitVerseSentences(text);
    if (!ranges.length) continue;
    out.set(v.verse, { ranges, weights: verseSentenceWeights(text, ranges) });
  }
  return out;
}

/** 跟读派生值的编码：`节号:句下标`。必须是原始值，useSyncExternalStore 才跳得过重渲染。 */
export function encodeFollowKey(verse: number, sentence: number): string {
  return `${verse}:${sentence}`;
}

export function decodeFollowKey(
  key: string,
  index: Map<number, VerseSentenceIndex>,
): { verse: number; sentence: VerseSentenceRange | null } | null {
  if (!key) return null;
  const [rawVerse, rawSentence] = key.split(":");
  const verse = Number(rawVerse);
  if (!Number.isInteger(verse) || verse <= 0) return null;
  const sentence = index.get(verse)?.ranges[Number(rawSentence)] ?? null;
  return { verse, sentence };
}
