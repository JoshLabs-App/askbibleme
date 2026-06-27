import type {
  NtDeepRepeatChaptersReadKeys,
  NtDeepRepeatReadingState,
  NtDeepRepeatTrack,
} from "./nt-deep-repeat-reading";
import { trackForNtDeepRepeatBookId } from "./nt-deep-repeat-reading";

export function ntDeepRepeatChapterReadKey(bookId: string, chapter: number): string {
  return `${bookId.trim().toUpperCase()}:${Math.max(1, Math.floor(chapter))}`;
}

export function normalizeNtDeepRepeatChaptersReadKeys(
  raw: Partial<NtDeepRepeatChaptersReadKeys> | undefined,
): NtDeepRepeatChaptersReadKeys {
  const norm = (arr: unknown): string[] =>
    Array.isArray(arr)
      ? arr.filter((k): k is string => typeof k === "string" && k.length > 0)
      : [];
  return {
    ot: norm(raw?.ot),
    nt: norm(raw?.nt),
  };
}

export function addNtDeepRepeatChapterReadToState(
  state: NtDeepRepeatReadingState,
  bookId: string,
  chapter: number,
  track?: NtDeepRepeatTrack,
): NtDeepRepeatReadingState {
  const resolved = track ?? trackForNtDeepRepeatBookId(bookId);
  if (!resolved) return state;
  const key = ntDeepRepeatChapterReadKey(bookId, chapter);
  const keys = normalizeNtDeepRepeatChaptersReadKeys(state.chaptersReadKeys);
  if (keys[resolved].includes(key)) {
    return state;
  }
  const nextKeys: NtDeepRepeatChaptersReadKeys = {
    ...keys,
    [resolved]: [...keys[resolved], key],
  };
  return {
    ...state,
    chaptersReadKeys: nextKeys,
    chaptersRead: {
      ot: nextKeys.ot.length,
      nt: nextKeys.nt.length,
    },
  };
}

export function ntDeepRepeatTrackChapterReadCount(
  state: NtDeepRepeatReadingState,
  track: NtDeepRepeatTrack,
): number {
  return normalizeNtDeepRepeatChaptersReadKeys(state.chaptersReadKeys)[track].length;
}
