import { getReadingPlanDaySinceEpoch } from "@/lib/read/reading-plan-epoch";
import type { ReadingPlanPrefs } from "./reading-plan-prefs";
import {
  normalizeTripleLoopReadingState,
  tripleLoopStateForPlanDay,
  TRIPLE_LOOP_NT_BOOK_IDS,
  TRIPLE_LOOP_OT_BOOK_IDS,
  TRIPLE_LOOP_WISDOM_BOOK_IDS,
  type TripleLoopPointer,
  type TripleLoopReadingState,
  type TripleLoopTrack,
} from "./triple-loop-reading";

function trackOrder(track: TripleLoopTrack): string[] {
  if (track === "ot") return TRIPLE_LOOP_OT_BOOK_IDS;
  if (track === "nt") return TRIPLE_LOOP_NT_BOOK_IDS;
  return TRIPLE_LOOP_WISDOM_BOOK_IDS;
}

function pointerProgress(pointer: TripleLoopPointer, order: string[]): number {
  const bookIdx = order.indexOf(pointer.bookId);
  return (bookIdx >= 0 ? bookIdx : 0) * 10_000 + pointer.chapter;
}

function inferTrackPlanDay(
  state: TripleLoopReadingState,
  track: TripleLoopTrack,
  calendarDay: number,
): number {
  const order = trackOrder(track);
  let day = calendarDay;
  for (let d = calendarDay; d < calendarDay + 400; d += 1) {
    const planPtr = tripleLoopStateForPlanDay(d)[track];
    if (pointerProgress(state[track], order) >= pointerProgress(planPtr, order)) {
      day = d;
    } else {
      break;
    }
  }
  return day;
}

export function inferTripleLoopPlanDay(
  raw: Partial<TripleLoopReadingState> | null | undefined,
  now = new Date(),
): number {
  const state = normalizeTripleLoopReadingState(raw);
  const calendarDay = getReadingPlanDaySinceEpoch(now);
  const tracks: TripleLoopTrack[] = ["ot", "nt", "wisdom"];
  let minDay = calendarDay;
  for (const track of tracks) {
    minDay = Math.min(minDay, inferTrackPlanDay(state, track, calendarDay));
  }
  return minDay;
}

export function inferTripleLoopAheadDays(
  raw: Partial<TripleLoopReadingState> | null | undefined,
  now = new Date(),
): number {
  const calendarDay = getReadingPlanDaySinceEpoch(now);
  return Math.max(0, inferTripleLoopPlanDay(raw, now) - calendarDay);
}

export function reconcileTripleLoopAheadDays(
  prefs: ReadingPlanPrefs,
  _progress?: Partial<TripleLoopReadingState> | null,
  _now = new Date(),
): ReadingPlanPrefs {
  // Prefs win. Raising aheadDays from farther progress undoes「设为今日」after sync.
  return prefs;
}
