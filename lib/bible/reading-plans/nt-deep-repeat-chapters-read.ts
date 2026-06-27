import type {
  NtDeepRepeatChaptersReadKeys,
  NtDeepRepeatReadingState,
  NtDeepRepeatTrack,
} from "@/lib/bible/reading-plans/nt-deep-repeat-reading";
import {
  isNtDeepRepeatCurriculumBookId,
  NT_DEEP_REPEAT_OT_BOOK_IDS,
} from "@/lib/bible/reading-plans/nt-deep-repeat-curriculum";

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

function trackForNtDeepRepeatBookId(bookId: string): NtDeepRepeatTrack | null {
  const id = bookId.trim().toUpperCase();
  if (NT_DEEP_REPEAT_OT_BOOK_IDS.includes(id)) return "ot";
  if (isNtDeepRepeatCurriculumBookId(id)) return "nt";
  return null;
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
  if (keys[resolved].includes(key)) return state;
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
