import { scriptureBooks, type ScriptureBook } from "@/lib/bible/scripture-books";
import {
  TRIPLE_LOOP_NT_BOOK_IDS,
  TRIPLE_LOOP_OT_BOOK_IDS,
  TRIPLE_LOOP_WISDOM_BOOK_IDS,
  type TripleLoopPointer,
  type TripleLoopReadingState,
  type TripleLoopTrack,
} from "@/lib/bible/reading-plans/triple-loop-reading";

export function orderForTripleLoopTrack(track: TripleLoopTrack): string[] {
  if (track === "ot") return TRIPLE_LOOP_OT_BOOK_IDS;
  if (track === "nt") return TRIPLE_LOOP_NT_BOOK_IDS;
  return TRIPLE_LOOP_WISDOM_BOOK_IDS;
}

function bookMeta(bookId: string): ScriptureBook | undefined {
  return scriptureBooks.find((b) => b.bookId === bookId);
}

/** 该轨（旧约 / 新约 / 智慧书）经卷总章数 */
export function totalChaptersInTripleLoopTrack(track: TripleLoopTrack): number {
  return orderForTripleLoopTrack(track).reduce((sum, bookId) => {
    return sum + (bookMeta(bookId)?.chapters ?? 0);
  }, 0);
}

function chaptersBeforePointer(track: TripleLoopTrack, pointer: TripleLoopPointer): number {
  const order = orderForTripleLoopTrack(track);
  if (!order.length) return 0;
  const pointerIndex = order.indexOf(pointer.bookId);
  if (pointerIndex < 0) return 0;
  let total = 0;
  for (let i = 0; i < pointerIndex; i += 1) {
    total += bookMeta(order[i]!)?.chapters ?? 0;
  }
  const pointerMax = Math.max(1, bookMeta(pointer.bookId)?.chapters ?? 1);
  const chapterOffset = Math.min(Math.max(1, Math.trunc(pointer.chapter)), pointerMax) - 1;
  return total + chapterOffset;
}

export function computeTripleLoopTrackBarProgress(
  state: TripleLoopReadingState,
  track: TripleLoopTrack,
  currentChapterFraction = 0,
): number {
  const total = totalChaptersInTripleLoopTrack(track);
  if (total <= 0) return 0;
  const pointer = state[track];
  const base = chaptersBeforePointer(track, pointer);
  const frac = Math.min(1, Math.max(0, currentChapterFraction));
  return Math.min(1, Math.max(0, (base + frac) / total));
}
