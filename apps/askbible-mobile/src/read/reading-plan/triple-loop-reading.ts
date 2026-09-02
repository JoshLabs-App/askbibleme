import { getScriptureBookDisplayName } from "../../bible/scripture-book-display-name";
import { scriptureBooks, type ScriptureBook } from "@/lib/bible/scripture-books";
import { t, tFormat } from "../../i18n/site-copy";
import {
  addUserChapterReadToState,
  normalizeTripleLoopChaptersReadKeys,
} from "@/lib/bible/reading-plans/triple-loop-chapters-read";

export type TripleLoopTrack = "ot" | "nt" | "wisdom";

export type TripleLoopPointer = {
  bookId: string;
  chapter: number;
};

export type TripleLoopChaptersRead = {
  ot: number;
  nt: number;
  wisdom: number;
};

export type TripleLoopChaptersReadKeys = {
  ot: string[];
  nt: string[];
  wisdom: string[];
};

export type TripleLoopReadingState = {
  ot: TripleLoopPointer;
  nt: TripleLoopPointer;
  wisdom: TripleLoopPointer;
  /** 用户实际读完的章（bookId:chapter），与计划指针无关 */
  chaptersReadKeys?: Partial<TripleLoopChaptersReadKeys>;
  /** 与 chaptersReadKeys 各轨长度同步，便于调试 */
  chaptersRead?: Partial<TripleLoopChaptersRead>;
  startedAt?: string;
};

const WISDOM_IDS = new Set<string>(["JOB", "PSA", "PRO", "ECC", "SNG"]);

const NT_START = scriptureBooks.findIndex((b) => b.bookId === "MAT");

export const TRIPLE_LOOP_OT_BOOK_IDS: string[] =
  NT_START < 0
    ? []
    : scriptureBooks
        .slice(0, NT_START)
        .filter((b) => !WISDOM_IDS.has(b.bookId))
        .map((b) => b.bookId);

export const TRIPLE_LOOP_NT_BOOK_IDS: string[] =
  NT_START < 0 ? [] : scriptureBooks.slice(NT_START).map((b) => b.bookId);

export const TRIPLE_LOOP_WISDOM_BOOK_IDS: string[] = ["JOB", "PSA", "PRO", "ECC", "SNG"];

function bookMeta(bookId: string): ScriptureBook | undefined {
  return scriptureBooks.find((b) => b.bookId === bookId);
}

function clampChapter(bookId: string, chapter: number): number {
  const meta = bookMeta(bookId);
  if (!meta || meta.chapters < 1) return 1;
  return Math.min(Math.max(1, chapter), meta.chapters);
}

function normalizePointerInOrder(bookId: string, chapter: number, order: string[]): TripleLoopPointer {
  if (!order.length) {
    return { bookId: "GEN", chapter: 1 };
  }
  const bid = order.includes(bookId) ? bookId : order[0]!;
  let ch = Number.isFinite(chapter) ? Math.floor(chapter) : 1;
  const meta = bookMeta(bid);
  if (!meta) {
    return { bookId: order[0]!, chapter: 1 };
  }
  ch = clampChapter(bid, ch);
  return { bookId: bid, chapter: ch };
}

export function createDefaultTripleLoopReadingState(): TripleLoopReadingState {
  return {
    ot: { bookId: "GEN", chapter: 1 },
    nt: { bookId: "MAT", chapter: 1 },
    wisdom: { bookId: "JOB", chapter: 1 },
    chaptersReadKeys: { ot: [], nt: [], wisdom: [] },
    chaptersRead: { ot: 0, nt: 0, wisdom: 0 },
  };
}

function normalizeChaptersRead(
  raw: Partial<TripleLoopChaptersRead> | undefined,
  fallback: TripleLoopChaptersRead,
): TripleLoopChaptersRead {
  const n = (v: unknown, d: number) => {
    const x = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : d;
    return Math.max(0, x);
  };
  return {
    ot: n(raw?.ot, fallback.ot),
    nt: n(raw?.nt, fallback.nt),
    wisdom: n(raw?.wisdom, fallback.wisdom),
  };
}

export function normalizeTripleLoopReadingState(
  raw: Partial<TripleLoopReadingState> | null | undefined,
): TripleLoopReadingState {
  const d = createDefaultTripleLoopReadingState();
  if (!raw || typeof raw !== "object") {
    return d;
  }
  const ot = normalizePointerInOrder(
    String(raw.ot?.bookId || d.ot.bookId),
    Number(raw.ot?.chapter) || 1,
    TRIPLE_LOOP_OT_BOOK_IDS,
  );
  const nt = normalizePointerInOrder(
    String(raw.nt?.bookId || d.nt.bookId),
    Number(raw.nt?.chapter) || 1,
    TRIPLE_LOOP_NT_BOOK_IDS,
  );
  const wisdom = normalizePointerInOrder(
    String(raw.wisdom?.bookId || d.wisdom.bookId),
    Number(raw.wisdom?.chapter) || 1,
    TRIPLE_LOOP_WISDOM_BOOK_IDS,
  );
  const normalized = {
    ot,
    nt,
    wisdom,
    startedAt: typeof raw.startedAt === "string" && raw.startedAt.trim() ? raw.startedAt.trim() : undefined,
  };
  const chaptersReadKeys = normalizeTripleLoopChaptersReadKeys(raw.chaptersReadKeys);
  const chaptersRead = {
    ot: chaptersReadKeys.ot.length,
    nt: chaptersReadKeys.nt.length,
    wisdom: chaptersReadKeys.wisdom.length,
  };
  return {
    ...normalized,
    chaptersReadKeys,
    chaptersRead,
  };
}

export function formatTripleLoopReadingLineVerbose(bookId: string, chapter: number): string {
  const name = getScriptureBookDisplayName(bookId) || bookId;
  const unit =
    bookId === "PSA" ? t("pages.read.tripleLoopPsalmUnit") : t("pages.read.tripleLoopChapterUnit");
  return tFormat("pages.read.tripleLoopReadingLine", {
    name,
    chapter: String(chapter),
    unit,
  });
}

export function trackForBookId(bookId: string): TripleLoopTrack | null {
  if (TRIPLE_LOOP_OT_BOOK_IDS.includes(bookId)) return "ot";
  if (TRIPLE_LOOP_NT_BOOK_IDS.includes(bookId)) return "nt";
  if (TRIPLE_LOOP_WISDOM_BOOK_IDS.includes(bookId)) return "wisdom";
  return null;
}

export function advanceTripleLoopPointer(current: TripleLoopPointer, order: string[]): TripleLoopPointer {
  const meta = bookMeta(current.bookId);
  const idx = order.indexOf(current.bookId);
  const safeIdx = idx >= 0 ? idx : 0;
  const maxCh = meta?.chapters ?? 1;

  if (meta && current.chapter < maxCh) {
    return { bookId: current.bookId, chapter: current.chapter + 1 };
  }

  const nextIdx = (safeIdx + 1) % order.length;
  return { bookId: order[nextIdx]!, chapter: 1 };
}

export function advanceTripleLoopTrack(state: TripleLoopReadingState, track: TripleLoopTrack): TripleLoopReadingState {
  const order =
    track === "ot" ? TRIPLE_LOOP_OT_BOOK_IDS : track === "nt" ? TRIPLE_LOOP_NT_BOOK_IDS : TRIPLE_LOOP_WISDOM_BOOK_IDS;
  const cur = state[track];
  const withRead = addUserChapterReadToState(state, cur.bookId, cur.chapter);
  const nextPtr = advanceTripleLoopPointer(cur, order);
  return { ...withRead, [track]: nextPtr };
}

export function advanceTripleLoopOneCalendarDay(state: TripleLoopReadingState): TripleLoopReadingState {
  return {
    ot: advanceTripleLoopPointer(state.ot, TRIPLE_LOOP_OT_BOOK_IDS),
    nt: advanceTripleLoopPointer(state.nt, TRIPLE_LOOP_NT_BOOK_IDS),
    wisdom: advanceTripleLoopPointer(state.wisdom, TRIPLE_LOOP_WISDOM_BOOK_IDS),
  };
}

export function tripleLoopStateForPlanDay(planDay: number): TripleLoopReadingState {
  let state = createDefaultTripleLoopReadingState();
  const advances = Math.max(0, Math.floor(planDay) - 1);
  for (let i = 0; i < advances; i++) {
    state = advanceTripleLoopOneCalendarDay(state);
  }
  return state;
}

function trackOrder(track: TripleLoopTrack): string[] {
  if (track === "ot") return TRIPLE_LOOP_OT_BOOK_IDS;
  if (track === "nt") return TRIPLE_LOOP_NT_BOOK_IDS;
  return TRIPLE_LOOP_WISDOM_BOOK_IDS;
}

function pointerProgress(pointer: TripleLoopPointer, order: string[]): number {
  const bookIdx = order.indexOf(pointer.bookId);
  return (bookIdx >= 0 ? bookIdx : 0) * 10_000 + pointer.chapter;
}

export function tripleLoopPointersEqual(
  left: TripleLoopReadingState,
  right: TripleLoopReadingState,
): boolean {
  const tracks: TripleLoopTrack[] = ["ot", "nt", "wisdom"];
  return tracks.every(
    (track) => left[track].bookId === right[track].bookId && left[track].chapter === right[track].chapter,
  );
}

/**
 * 日历日换天后，落后的轨对齐到该计划日；已超前的轨保持不动。
 * 已读章（chaptersReadKeys）只记录，不回退。
 */
export function snapTripleLoopStateToPlanDay(
  state: TripleLoopReadingState,
  planDay: number,
): TripleLoopReadingState {
  const floor = tripleLoopStateForPlanDay(planDay);
  const tracks: TripleLoopTrack[] = ["ot", "nt", "wisdom"];
  const next = Object.fromEntries(
    tracks.map((track) => {
      const order = trackOrder(track);
      const current = state[track];
      const min = floor[track];
      return [track, pointerProgress(current, order) >= pointerProgress(min, order) ? current : min];
    }),
  ) as Pick<TripleLoopReadingState, TripleLoopTrack>;
  return normalizeTripleLoopReadingState({
    ...next,
    chaptersReadKeys: state.chaptersReadKeys,
    startedAt: state.startedAt,
  });
}

/**
 * 三轨一起停在比 planDay 更前的同一进度时拉回（整日跳进度后 aheadDays 被清掉）。
 * 只超前其中一轨则保持不动。
 */
export function clipCoordinatedTripleLoopAheadToPlanDay(
  state: TripleLoopReadingState,
  planDay: number,
): TripleLoopReadingState {
  const floor = tripleLoopStateForPlanDay(planDay);
  const tracks: TripleLoopTrack[] = ["ot", "nt", "wisdom"];
  const coordinatedAhead = tracks.every((track) => {
    const order = trackOrder(track);
    return pointerProgress(state[track], order) > pointerProgress(floor[track], order);
  });
  if (!coordinatedAhead) return state;
  return normalizeTripleLoopReadingState({
    ...floor,
    chaptersReadKeys: state.chaptersReadKeys,
    startedAt: state.startedAt,
  });
}

export function pointerMatchesTrack(
  state: TripleLoopReadingState,
  track: TripleLoopTrack,
  bookId: string,
  chapter: number,
): boolean {
  const p = state[track];
  return p.bookId === bookId && p.chapter === chapter;
}

export function tripleLoopTrackTitle(track: TripleLoopTrack): string {
  if (track === "ot") return t("pages.read.tripleLoopTrackOt");
  if (track === "nt") return t("pages.read.tripleLoopTrackNt");
  return t("pages.read.tripleLoopTrackWisdom");
}
