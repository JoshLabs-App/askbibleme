import {
  birthDateAgeYears,
  birthDateDaysLived,
  birthDateLifeDay,
  toBirthDateMs,
  type ExploreBirthDate,
} from "./explore-birth-date";

/** 人生电量与「今天」进度条满格刻度（岁） */
export const CENTURY_SPAN_YEARS = 90;

/** 5 格电量；满格 = {@link CENTURY_SPAN_YEARS} 年，每格 18 年 */
export const LIFE_BATTERY_SEGMENT_COUNT = 5;

/** 按进度四舍五入到 0–5 格 */
export function lifeBatteryFilledSegments(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return Math.min(
    LIFE_BATTERY_SEGMENT_COUNT,
    Math.max(0, Math.round(p * LIFE_BATTERY_SEGMENT_COUNT)),
  );
}

/** 生日起算 {@link CENTURY_SPAN_YEARS} 年（进度按日历精确到日） */
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
  const endYear = birthDate.year + CENTURY_SPAN_YEARS - 1;
  const ageYears = birthDateAgeYears(birthDate, now);
  const daysLived = birthDateDaysLived(birthDate, now);
  const lifeDay = birthDateLifeDay(birthDate, now);

  const birthMs = toBirthDateMs(birthDate);
  const endMs = new Date(
    birthDate.year + CENTURY_SPAN_YEARS,
    birthDate.month - 1,
    birthDate.day,
  ).getTime();
  const nowMs = now.getTime();
  const spanMs = endMs - birthMs;
  const progress =
    spanMs <= 0 ? 0 : Math.min(1, Math.max(0, (nowMs - birthMs) / spanMs));

  return { startYear, endYear, currentYear, ageYears, daysLived, lifeDay, progress };
}
