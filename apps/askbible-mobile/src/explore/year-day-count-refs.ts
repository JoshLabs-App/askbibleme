import { getExploreModulesContent } from "./exploreModuleContent";

export type YearDayCountScriptureRef = {
  id: string;
  bookId: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
};

export function getYearDayCountLifeDayReadTarget() {
  return getExploreModulesContent().yearDayCount.lifeDayReadTarget;
}

export function getYearDayCountLeadRef(): YearDayCountScriptureRef {
  return getExploreModulesContent().yearDayCount.leadRef;
}

export function getYearDayCountScriptures(): YearDayCountScriptureRef[] {
  return getExploreModulesContent().yearDayCount.scriptures;
}
