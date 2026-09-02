import {
  birthDateAgeYears,
  birthDateDaysLived,
  birthDateLifeDay,
  toBirthDateMs,
  type ExploreBirthDate,
} from "@/lib/explore/explore-birth-date";
import { getExploreModulesContent } from "./exploreModuleContent";

export function getCenturySpanYears(): number {
  return getExploreModulesContent().centuryTimeline.spanYears;
}

export function getLifeBatterySegmentCount(): number {
  return getExploreModulesContent().centuryTimeline.batterySegmentCount;
}

/** 按进度四舍五入到 0–5 格 */
export function lifeBatteryFilledSegments(progress: number): number {
  const segmentCount = getLifeBatterySegmentCount();
  const p = Math.min(1, Math.max(0, progress));
  return Math.min(segmentCount, Math.max(0, Math.round(p * segmentCount)));
}

/** 生日起算 {@link getCenturySpanYears} 年（进度按日历精确到日） */
export function getCenturyTimeline(
  birthDate: ExploreBirthDate,
  now: Date = new Date(),
): {
  startYear: number;
  endYear: number;
  currentYear: number;
  ageYears: number;
  daysLived: number;
  lifeDay: number;
  progress: number;
} {
  const currentYear = now.getFullYear();
  const startYear = birthDate.year;
  const spanYears = getCenturySpanYears();
  const endYear = birthDate.year + spanYears - 1;
  const ageYears = birthDateAgeYears(birthDate, now);
  const daysLived = birthDateDaysLived(birthDate, now);
  const lifeDay = birthDateLifeDay(birthDate, now);

  const birthMs = toBirthDateMs(birthDate);
  const endMs = new Date(
    birthDate.year + spanYears,
    birthDate.month - 1,
    birthDate.day,
  ).getTime();
  const nowMs = now.getTime();
  const spanMs = endMs - birthMs;
  const progress =
    spanMs <= 0 ? 0 : Math.min(1, Math.max(0, (nowMs - birthMs) / spanMs));

  return { startYear, endYear, currentYear, ageYears, daysLived, lifeDay, progress };
}
