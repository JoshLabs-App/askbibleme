export type ReadingPlanRange = {
  bookId: string;
  startChapter: number;
  endChapter: number;
  startVerse?: number;
  endVerse?: number;
  label: string;
  planChapterTotal: number;
};

export type ReadingPlanDay = {
  dayIndex: number;
  readings: ReadingPlanRange[];
};

export type ReadingPlanRegistryEntry = {
  planId: string;
  name: string;
  abbreviation?: string;
  description?: string;
  sourceUrl: string;
  bundlePath: string;
  dayCount: number;
  maxReadingsPerDay: number;
  listHidden?: boolean;
  listPriority?: number;
};

export type ReadingPlanRegistry = {
  schemaVersion: 1;
  upstreamNote: string;
  plans: ReadingPlanRegistryEntry[];
};
