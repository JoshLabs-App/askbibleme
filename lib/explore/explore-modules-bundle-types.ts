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
  bookId: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  refDisplay: string;
};

/** 探索首页第二行（预埋）图标：远程可见性 + 可选文案覆盖 */
export type ExploreHomeLocalizedText = {
  zh?: string;
  zhTw?: string;
  en?: string;
};

/** 预埋槽位 `staged-04`…`staged-09` 的远程经文汇编模块 */
export type ExploreModulesRemoteStagedModule = {
  pageTitle?: string;
  pageTitleTw?: string;
  pageTitleEn?: string;
  bookAbbrToId: Record<string, string>;
  categories: ExploreModulesCategory[];
  titlesEn?: string[];
};

export type ExploreModulesExploreHome = {
  /** 远程放出的预埋图标 id；默认空数组 = 全部隐藏 */
  visibleStagedEntryIds: string[];
  sectionCaption?: ExploreHomeLocalizedText;
  entryLabels?: Record<string, ExploreHomeLocalizedText>;
  remoteModules?: Record<string, ExploreModulesRemoteStagedModule>;
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
    lifeDayReadTarget: { bookId: string; chapter: number; verse: number; refDisplay: string };
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
  exploreHome?: ExploreModulesExploreHome;
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
