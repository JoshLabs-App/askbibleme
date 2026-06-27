import { normalizeNtDeepRepeatChaptersReadKeys } from "@/lib/bible/reading-plans/nt-deep-repeat-chapters-read";
import {
  getNtDeepRepeatSegment,
  NT_DEEP_REPEAT_CURRICULUM,
  NT_DEEP_REPEAT_OT_BOOK_IDS,
  type NtDeepRepeatSegment,
} from "@/lib/bible/reading-plans/nt-deep-repeat-curriculum";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  segmentDayTargetForStage,
  standardSegmentDayCount,
  type NtDeepRepeatPace,
  isNtDeepRepeatPace,
} from "@/lib/bible/reading-plans/nt-deep-repeat-pace";
import { toLocalDateString } from "@/lib/read/reading-plan-prefs";
import { scriptureBooks, type ScriptureBook } from "@/lib/bible/scripture-books";

export type NtDeepRepeatTrack = "ot" | "nt";

export type NtDeepRepeatPointer = {
  bookId: string;
  chapter: number;
};

export type NtDeepRepeatChaptersReadKeys = {
  ot: string[];
  nt: string[];
};

export type NtDeepRepeatReadingState = {
  ot: NtDeepRepeatPointer;
  curriculumIndex: number;
  dayInSegment: number;
  pace: NtDeepRepeatPace;
  segmentDayTarget: number;
  chaptersReadKeys?: Partial<NtDeepRepeatChaptersReadKeys>;
  chaptersRead?: { ot: number; nt: number };
  startedAt?: string;
};

function bookMeta(bookId: string): ScriptureBook | undefined {
  return scriptureBooks.find((b) => b.bookId === bookId);
}

function clampChapter(bookId: string, chapter: number): number {
  const meta = bookMeta(bookId);
  if (!meta || meta.chapters < 1) return 1;
  return Math.min(Math.max(1, Math.floor(chapter)), meta.chapters);
}

function normalizePointerInOrder(
  bookId: string,
  chapter: number,
  order: string[],
): NtDeepRepeatPointer {
  if (!order.length) return { bookId: "GEN", chapter: 1 };
  const bid = order.includes(bookId) ? bookId : order[0]!;
  return { bookId: bid, chapter: clampChapter(bid, chapter) };
}

function parseLocalDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return new Date(y, mo - 1, da);
}

export function resolveNtDeepRepeatSegmentDayTarget(state: NtDeepRepeatReadingState): number {
  if (typeof state.segmentDayTarget === "number" && state.segmentDayTarget > 0) {
    return state.segmentDayTarget;
  }
  const startedOn = state.startedAt?.trim() || toLocalDateString(new Date());
  return segmentDayTargetForStage(state.curriculumIndex, state.pace, startedOn);
}

export function createDefaultNtDeepRepeatReadingState(
  pace: NtDeepRepeatPace = NT_DEEP_REPEAT_DEFAULT_PACE,
  now = new Date(),
): NtDeepRepeatReadingState {
  const startedAt = toLocalDateString(now);
  return {
    ot: { bookId: "GEN", chapter: 1 },
    curriculumIndex: 0,
    dayInSegment: 1,
    pace,
    segmentDayTarget: segmentDayTargetForStage(0, pace, startedAt),
    chaptersReadKeys: { ot: [], nt: [] },
    chaptersRead: { ot: 0, nt: 0 },
    startedAt,
  };
}

export function normalizeNtDeepRepeatReadingState(
  raw: Partial<NtDeepRepeatReadingState> | null | undefined,
): NtDeepRepeatReadingState {
  const now = new Date();
  const pace = isNtDeepRepeatPace(raw?.pace) ? raw.pace : NT_DEEP_REPEAT_DEFAULT_PACE;
  const startedAt =
    typeof raw?.startedAt === "string" && raw.startedAt.trim()
      ? raw.startedAt.trim()
      : toLocalDateString(now);
  const d = createDefaultNtDeepRepeatReadingState(pace, parseLocalDate(startedAt) ?? now);
  if (!raw || typeof raw !== "object") return d;

  const rawCurriculumIndex = raw.curriculumIndex;
  const curriculumIndex =
    typeof rawCurriculumIndex === "number" && Number.isFinite(rawCurriculumIndex)
      ? Math.max(0, Math.floor(rawCurriculumIndex))
      : 0;
  const segmentDayTarget =
    typeof raw.segmentDayTarget === "number" && raw.segmentDayTarget > 0
      ? Math.floor(raw.segmentDayTarget)
      : segmentDayTargetForStage(curriculumIndex, pace, startedAt);
  const rawDayInSegment = raw.dayInSegment;
  const dayInSegment =
    typeof rawDayInSegment === "number" && Number.isFinite(rawDayInSegment)
      ? Math.min(segmentDayTarget, Math.max(1, Math.floor(rawDayInSegment)))
      : 1;

  const chaptersReadKeys = normalizeNtDeepRepeatChaptersReadKeys(raw.chaptersReadKeys);
  return {
    ot: normalizePointerInOrder(
      String(raw.ot?.bookId || d.ot.bookId),
      Number(raw.ot?.chapter) || 1,
      NT_DEEP_REPEAT_OT_BOOK_IDS,
    ),
    curriculumIndex,
    dayInSegment,
    pace,
    segmentDayTarget,
    chaptersReadKeys,
    chaptersRead: {
      ot: chaptersReadKeys.ot.length,
      nt: chaptersReadKeys.nt.length,
    },
    startedAt,
  };
}

export function currentNtDeepRepeatSegment(state: NtDeepRepeatReadingState): NtDeepRepeatSegment | null {
  return getNtDeepRepeatSegment(state.curriculumIndex);
}

export function advanceNtDeepRepeatOtPointer(current: NtDeepRepeatPointer): NtDeepRepeatPointer {
  const meta = bookMeta(current.bookId);
  const idx = NT_DEEP_REPEAT_OT_BOOK_IDS.indexOf(current.bookId);
  const safeIdx = idx >= 0 ? idx : 0;
  const maxCh = meta?.chapters ?? 1;

  if (meta && current.chapter < maxCh) {
    return { bookId: current.bookId, chapter: current.chapter + 1 };
  }

  const nextIdx = (safeIdx + 1) % NT_DEEP_REPEAT_OT_BOOK_IDS.length;
  return { bookId: NT_DEEP_REPEAT_OT_BOOK_IDS[nextIdx]!, chapter: 1 };
}

export function advanceNtDeepRepeatOneCalendarDay(state: NtDeepRepeatReadingState): NtDeepRepeatReadingState {
  const target = resolveNtDeepRepeatSegmentDayTarget(state);
  let nextDay = state.dayInSegment + 1;
  let nextIndex = state.curriculumIndex;
  let nextTarget = target;
  if (nextDay > target) {
    nextDay = 1;
    nextIndex = (state.curriculumIndex + 1) % Math.max(1, NT_DEEP_REPEAT_CURRICULUM.length);
    nextTarget = standardSegmentDayCount(state.pace);
  }
  return {
    ...state,
    ot: advanceNtDeepRepeatOtPointer(state.ot),
    curriculumIndex: nextIndex,
    dayInSegment: nextDay,
    segmentDayTarget: nextTarget,
  };
}

export function ntDeepRepeatStateForPlanDay(
  planDay: number,
  opts?: { pace?: NtDeepRepeatPace; startedAt?: string },
): NtDeepRepeatReadingState {
  const pace = opts?.pace ?? NT_DEEP_REPEAT_DEFAULT_PACE;
  const startDate = opts?.startedAt ? parseLocalDate(opts.startedAt) : null;
  let state = createDefaultNtDeepRepeatReadingState(pace, startDate ?? new Date());
  if (opts?.startedAt) state.startedAt = opts.startedAt;
  const safeDay = Math.max(1, Math.floor(planDay));
  for (let i = 1; i < safeDay; i += 1) {
    state = advanceNtDeepRepeatOneCalendarDay(state);
  }
  return state;
}

export function parseNtDeepRepeatProgress(raw: string | null): NtDeepRepeatReadingState | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<NtDeepRepeatReadingState>;
    return normalizeNtDeepRepeatReadingState(j);
  } catch {
    return null;
  }
}
