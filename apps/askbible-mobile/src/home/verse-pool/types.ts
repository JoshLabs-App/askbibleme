import type { AppLocale } from "../../i18n/config";

export type HomeVerseEntry = {
  lines: string[];
  ref: string;
};

export type HomePrayerManifestV1 = {
  version: 1;
  scopeId: string;
  chunkSize: number;
  entries: { verseKey: string; weight: number; chunkIndex: number }[];
  bootstrapVerseKeys?: string[];
};

export type HomePrayerChunkVerseV1 = {
  verseKey: string;
  weight: number;
  locales: Record<AppLocale, HomeVerseEntry>;
  byTranslationId?: Record<string, HomeVerseEntry>;
};

export type HomePrayerChunkV1 = {
  version: 1;
  scopeId: string;
  chunkIndex: number;
  verses: HomePrayerChunkVerseV1[];
};

export type PrayerMemoryRowV1 = {
  lastShownAt: number;
  intervalMs: number;
  level: number;
};
