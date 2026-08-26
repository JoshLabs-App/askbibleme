/** 今天在全年时间轴上的位置（0 = 年初，1 = 年末） */
export function getYearDayTimeline(now: Date = new Date()): {
  dayOfYear: number;
  daysInYear: number;
  progress: number;
} {
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const msPerDay = 86_400_000;
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / msPerDay) + 1;
  const daysInYear = Math.round((end.getTime() - start.getTime()) / msPerDay);
  const progress =
    daysInYear <= 1 ? 0 : Math.min(1, Math.max(0, (dayOfYear - 1) / (daysInYear - 1)));
  return { dayOfYear, daysInYear, progress };
}

export type YearDayRange = {
  /** 1-based inclusive */
  startDay: number;
  /** 1-based inclusive */
  endDay: number;
};

function localDateToDayOfYear(iso: string, year: number, yearStartMs: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m || Number(m[1]) !== year) return null;
  const dayMs = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const day = Math.floor((dayMs - yearStartMs) / 86_400_000) + 1;
  return day >= 1 ? day : null;
}

/**
 * 当年、今天之前已读过的日历日，合并为连续区间（不含今日）。
 * 用于年日轴浅色进度。
 */
export function buildYearReadRangesBeforeToday(
  completedDates: readonly string[],
  now: Date = new Date(),
): YearDayRange[] {
  const year = now.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const { dayOfYear, daysInYear } = getYearDayTimeline(now);
  const yearStartMs = yearStart.getTime();

  const days: number[] = [];
  for (const iso of completedDates) {
    const day = localDateToDayOfYear(iso, year, yearStartMs);
    if (day == null || day >= dayOfYear || day > daysInYear) continue;
    days.push(day);
  }
  if (days.length === 0) return [];

  days.sort((a, b) => a - b);
  const ranges: YearDayRange[] = [];
  let start = days[0]!;
  let end = start;
  for (let i = 1; i < days.length; i += 1) {
    const d = days[i]!;
    if (d === end || d === end + 1) {
      end = d;
      continue;
    }
    ranges.push({ startDay: start, endDay: end });
    start = d;
    end = d;
  }
  ranges.push({ startDay: start, endDay: end });
  return ranges;
}

/** 区间在全年轴上的 left/width（0–1），按等分日槽对齐。 */
export function yearDayRangeToTrackFraction(
  range: YearDayRange,
  daysInYear: number,
): { left: number; width: number } {
  if (daysInYear <= 0) return { left: 0, width: 0 };
  const start = Math.max(1, range.startDay);
  const end = Math.min(daysInYear, Math.max(start, range.endDay));
  return {
    left: (start - 1) / daysInYear,
    width: (end - start + 1) / daysInYear,
  };
}
