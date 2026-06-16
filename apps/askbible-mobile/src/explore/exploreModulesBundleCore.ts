import bundledJson from "./explore-modules-bundled.json";
import type { YearsDaysEternityDocument } from "./years-days-eternity-types";

export type ExploreModulesPrayerScenario = {
  title: string;
  titleTw: string;
  titleEn: string;
  refs: string[];
};

export type ExploreModulesCategory = {
  title: string;
  refs: string[];
};

export type ExploreModulesBiblicalLifespanEntry = {
  id: string;
  era: string;
  name: string;
  lifespanDisplay: string;
  years: number;
  refDisplay: string;
  bookId: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
};

export type ExploreModulesYearDayCountScriptureRef = {
  id: string;
  bookId: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
};

export type ExploreModulesBundle = {
  schemaVersion: 1;
  contentVersion: string;
  prayer: {
    bookAbbrToId: Record<string, string>;
    scenarios: ExploreModulesPrayerScenario[];
  };
  narrowGate: {
    bookAbbrToId: Record<string, string>;
    categories: ExploreModulesCategory[];
    titlesEn: string[];
  };
  praiseWorship: {
    bookAbbrToId: Record<string, string>;
    categories: ExploreModulesCategory[];
    titlesEn: string[];
  };
  wordOfGod: {
    bookAbbrToId: Record<string, string>;
    categories: ExploreModulesCategory[];
    titlesEn: string[];
  };
  yearsDaysEternity: {
    zh: YearsDaysEternityDocument;
    en: YearsDaysEternityDocument;
  };
  yearDayCount: {
    lifeDayReadTarget: { bookId: string; chapter: number; verseStart: number };
    leadRef: ExploreModulesYearDayCountScriptureRef;
    scriptures: ExploreModulesYearDayCountScriptureRef[];
  };
  biblicalLifespans: {
    scaleYears: number;
    ntScaleYears: number;
    modernEra: string;
    era: Record<string, string>;
    lifespans: ExploreModulesBiblicalLifespanEntry[];
  };
  centuryTimeline: {
    spanYears: number;
    batterySegmentCount: number;
  };
};

export function isExploreModulesBundle(raw: unknown): raw is ExploreModulesBundle {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Partial<ExploreModulesBundle>;
  if (o.schemaVersion !== 1 || typeof o.contentVersion !== "string") return false;
  return Boolean(
    o.prayer?.scenarios?.length
      && o.narrowGate?.categories?.length
      && o.praiseWorship?.categories?.length
      && o.wordOfGod?.categories?.length
      && o.yearsDaysEternity?.zh
      && o.yearsDaysEternity?.en
      && o.yearDayCount?.scriptures?.length
      && o.biblicalLifespans?.lifespans?.length,
  );
}

export function getBundledExploreModulesBundle(): ExploreModulesBundle {
  return bundledJson as ExploreModulesBundle;
}
