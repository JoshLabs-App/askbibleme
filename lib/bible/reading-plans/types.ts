/**
 * Normalized on-disk reading plan units (66-book `bookId` matches `scripture-books`).
 * Used by optional reading-plan UI; verses are hints for future anchors — chapter reading links use startChapter.
 */
export type ReadingPlanRange = {
  bookId: string;
  startChapter: number;
  endChapter: number;
  startVerse?: number;
  endVerse?: number;
  /** Original upstream label (English), for display / audit. */
  label: string;
  /** 预计算：该读经项所属计划章数（bundle 导入或三环构建时写入）。 */
  planChapterTotal: number;
};

export type ReadingPlanDay = {
  dayIndex: number;
  /** Ordered readings for that calendar day (may be one or many). */
  readings: ReadingPlanRange[];
};

export type ReadingPlanBundle = {
  schemaVersion: 1;
  /** Stable id from upstream or assigned during import. */
  planId: string;
  abbreviation?: string;
  name: string;
  description?: string;
  /** GitHub raw URL or other provenance. */
  sourceUrl: string;
  days: ReadingPlanDay[];
};

export type ReadingPlanRegistryEntry = {
  planId: string;
  name: string;
  abbreviation?: string;
  description?: string;
  sourceUrl: string;
  /** Relative to repo root. */
  bundlePath: string;
  dayCount: number;
  maxReadingsPerDay: number;
  /** If true, omitted from plan picker lists (bundle file may still exist). */
  listHidden?: boolean;
  /** Lower sorts earlier in the plan picker (default 100). */
  listPriority?: number;
};

export type ReadingPlanRegistry = {
  schemaVersion: 1;
  /** Upstream collection this registry was generated from. */
  upstreamNote: string;
  plans: ReadingPlanRegistryEntry[];
};
