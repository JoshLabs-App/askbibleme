import type { AppLocale } from "../i18n/config";

export type WidgetVerseItemV1 = {
  verseKey: string;
  lines: string[];
  ref: string;
};

/** Widget snapshot: pre-resolved app verse pool for timed rotation + tap advance. */
export type DailyVerseWidgetSnapshotV2 = {
  version: 2;
  date: string;
  locale: AppLocale;
  translationId: string;
  scopeId: string;
  rotationPoolKey: string;
  rotationIntervalSec: number;
  verses: WidgetVerseItemV1[];
  readDays: number;
  streakDays: number;
  readDaysLabel: string;
  streakDaysLabel: string;
};

export type DailyVerseWidgetSnapshot = DailyVerseWidgetSnapshotV2;

export function widgetVerseDisplayLine(item: WidgetVerseItemV1): string {
  return item.lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}
