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
