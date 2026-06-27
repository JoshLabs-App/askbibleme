import { scriptureBooks, type ScriptureBook } from "@/lib/bible/scripture-books";

export type NtDeepRepeatChapterRange = {
  bookId: string;
  startChapter: number;
  endChapter: number;
};

export type NtDeepRepeatSegment = {
  ranges: NtDeepRepeatChapterRange[];
};

/** @deprecated 固定 30 天已弃用；节奏见 `nt-deep-repeat-pace.ts`（7 / 14 / 28 天）。 */
export const NT_DEEP_REPEAT_SEGMENT_DAYS = 30;

type CurriculumUnit = {
  bookIds: readonly string[];
  /** 单元内按章累计切分，每段章数（4–6 为主；16 章书 5+5+6；太/徒 7×4）。 */
  segmentSizes: readonly number[];
};

/** 麦克阿瑟书卷顺序；52 阶 ≈ 12 个月 @ 7 天/阶。 */
const CURRICULUM_UNITS: CurriculumUnit[] = [
  { bookIds: ["1JN"], segmentSizes: [5] },
  { bookIds: ["JHN"], segmentSizes: [5, 5, 5, 6] },
  { bookIds: ["PHP", "COL"], segmentSizes: [4, 4] },
  { bookIds: ["MAT"], segmentSizes: [4, 4, 4, 4, 4, 4, 4] },
  { bookIds: ["ACT"], segmentSizes: [4, 4, 4, 4, 4, 4, 4] },
  { bookIds: ["MRK"], segmentSizes: [5, 5, 6] },
  { bookIds: ["ROM"], segmentSizes: [5, 5, 6] },
  { bookIds: ["GAL"], segmentSizes: [6] },
  { bookIds: ["EPH"], segmentSizes: [6] },
  { bookIds: ["1TH", "2TH"], segmentSizes: [5, 3] },
  { bookIds: ["1CO"], segmentSizes: [5, 5, 6] },
  { bookIds: ["2CO"], segmentSizes: [5, 5, 3] },
  { bookIds: ["1TI"], segmentSizes: [6] },
  { bookIds: ["2TI", "TIT", "PHM"], segmentSizes: [4, 4] },
  { bookIds: ["HEB"], segmentSizes: [5, 5, 3] },
  { bookIds: ["1PE", "2PE"], segmentSizes: [5, 3] },
  { bookIds: ["JAS", "2JN", "3JN", "JUD"], segmentSizes: [5, 3] },
  { bookIds: ["REV"], segmentSizes: [5, 5, 5, 4, 3] },
];

export const NT_DEEP_REPEAT_NT_BOOK_IDS: string[] = [
  ...new Set(CURRICULUM_UNITS.flatMap((u) => [...u.bookIds])),
];

function bookMeta(bookId: string): ScriptureBook | undefined {
  return scriptureBooks.find((b) => b.bookId === bookId);
}

function unitChapterCount(unit: CurriculumUnit): number {
  return unit.bookIds.reduce((sum, id) => sum + (bookMeta(id)?.chapters ?? 0), 0);
}

function absoluteRangeToBookRanges(
  unit: CurriculumUnit,
  absStart: number,
  absEnd: number,
): NtDeepRepeatChapterRange[] {
  const out: NtDeepRepeatChapterRange[] = [];
  let offset = 0;
  for (const bookId of unit.bookIds) {
    const ch = bookMeta(bookId)?.chapters ?? 0;
    const bookStart = offset + 1;
    const bookEnd = offset + ch;
    const overlapStart = Math.max(absStart, bookStart);
    const overlapEnd = Math.min(absEnd, bookEnd);
    if (overlapStart <= overlapEnd) {
      out.push({
        bookId,
        startChapter: overlapStart - offset,
        endChapter: overlapEnd - offset,
      });
    }
    offset += ch;
  }
  return out;
}

function buildCurriculum(): NtDeepRepeatSegment[] {
  const out: NtDeepRepeatSegment[] = [];
  for (const unit of CURRICULUM_UNITS) {
    const total = unitChapterCount(unit);
    const sumSizes = unit.segmentSizes.reduce((a, b) => a + b, 0);
    if (sumSizes !== total) {
      throw new Error(
        `nt-deep-repeat curriculum: ${unit.bookIds.join("+")} sizes sum ${sumSizes} != ${total} chapters`,
      );
    }
    let absStart = 1;
    for (const size of unit.segmentSizes) {
      const absEnd = absStart + size - 1;
      out.push({ ranges: absoluteRangeToBookRanges(unit, absStart, absEnd) });
      absStart = absEnd + 1;
    }
  }
  if (out.length !== 52) {
    throw new Error(`nt-deep-repeat curriculum: expected 52 stages, got ${out.length}`);
  }
  return out;
}

export const NT_DEEP_REPEAT_CURRICULUM: NtDeepRepeatSegment[] = buildCurriculum();

/** @deprecated 一轮天数因节奏与开局日而异；见 `ntDeepRepeatOneCycleDays`。 */
export const NT_DEEP_REPEAT_NT_CYCLE_DAYS =
  NT_DEEP_REPEAT_CURRICULUM.length * NT_DEEP_REPEAT_SEGMENT_DAYS;

const NT_START = scriptureBooks.findIndex((b) => b.bookId === "MAT");

export const NT_DEEP_REPEAT_OT_BOOK_IDS: string[] =
  NT_START < 0 ? [] : scriptureBooks.slice(0, NT_START).map((b) => b.bookId);

export function getNtDeepRepeatSegment(index: number): NtDeepRepeatSegment | null {
  if (!NT_DEEP_REPEAT_CURRICULUM.length) return null;
  const i = ((Math.floor(index) % NT_DEEP_REPEAT_CURRICULUM.length) + NT_DEEP_REPEAT_CURRICULUM.length)
    % NT_DEEP_REPEAT_CURRICULUM.length;
  return NT_DEEP_REPEAT_CURRICULUM[i] ?? null;
}

export function ntDeepRepeatSegmentPrimaryRange(segment: NtDeepRepeatSegment): NtDeepRepeatChapterRange {
  return segment.ranges[0]!;
}

export function ntDeepRepeatSegmentIncludesChapter(
  segment: NtDeepRepeatSegment,
  bookId: string,
  chapter: number,
): boolean {
  const id = bookId.trim().toUpperCase();
  return segment.ranges.some(
    (r) => r.bookId === id && chapter >= r.startChapter && chapter <= r.endChapter,
  );
}

export function ntDeepRepeatSegmentKey(segment: NtDeepRepeatSegment): string {
  return segment.ranges.map((r) => `${r.bookId}:${r.startChapter}-${r.endChapter}`).join("|");
}

export function isNtDeepRepeatCurriculumBookId(bookId: string): boolean {
  return NT_DEEP_REPEAT_NT_BOOK_IDS.includes(bookId.trim().toUpperCase());
}
