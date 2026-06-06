import type {
  TripleLoopChaptersRead,
  TripleLoopChaptersReadKeys,
  TripleLoopReadingState,
  TripleLoopTrack,
} from "@/lib/bible/reading-plans/triple-loop-reading";
import { trackForBookId } from "@/lib/bible/reading-plans/triple-loop-reading";

export function tripleLoopChapterReadKey(bookId: string, chapter: number): string {
  return `${bookId.trim().toUpperCase()}:${Math.floor(chapter)}`;
}

export function normalizeTripleLoopChaptersReadKeys(
  raw: Partial<TripleLoopChaptersReadKeys> | undefined,
): TripleLoopChaptersReadKeys {
  const pick = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.filter((k): k is string => typeof k === "string" && k.includes(":")))];
  };
  return {
    ot: pick(raw?.ot),
    nt: pick(raw?.nt),
    wisdom: pick(raw?.wisdom),
  };
}

export function countUserChaptersReadInTrack(
  state: TripleLoopReadingState,
  track: TripleLoopTrack,
): number {
  const keys = normalizeTripleLoopChaptersReadKeys(state.chaptersReadKeys);
  return keys[track].length;
}

/** 记录用户实际读完的一章（同一章不重复计数） */
export function addUserChapterReadToState(
  state: TripleLoopReadingState,
  bookId: string,
  chapter: number,
): TripleLoopReadingState {
  const track = trackForBookId(bookId);
  if (!track) return state;

  const key = tripleLoopChapterReadKey(bookId, chapter);
  const keys = normalizeTripleLoopChaptersReadKeys(state.chaptersReadKeys);
  if (keys[track].includes(key)) {
    return state;
  }

  const nextKeys: TripleLoopChaptersReadKeys = {
    ...keys,
    [track]: [...keys[track], key],
  };

  const readCount: TripleLoopChaptersRead = {
    ot: nextKeys.ot.length,
    nt: nextKeys.nt.length,
    wisdom: nextKeys.wisdom.length,
  };

  return {
    ...state,
    chaptersReadKeys: nextKeys,
    chaptersRead: readCount,
  };
}
