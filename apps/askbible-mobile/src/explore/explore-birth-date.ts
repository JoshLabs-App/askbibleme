export type ExploreBirthDate = {
  year: number;
  month: number;
  day: number;
};

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function toBirthDateMs(d: ExploreBirthDate): number {
  return new Date(d.year, d.month - 1, d.day).getTime();
}

export function isValidBirthDate(d: ExploreBirthDate, now: Date = new Date()): boolean {
  const { year, month, day } = d;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > now.getFullYear()) return false;
  if (month < 1 || month > 12) return false;
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) return false;
  const birth = new Date(year, month - 1, day);
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  ) {
    return false;
  }
  return birth.getTime() <= now.getTime();
}

/** 月/日变化后把「日」收进当月最后一天 */
export function clampBirthDate(d: ExploreBirthDate): ExploreBirthDate {
  const maxDay = daysInMonth(d.year, d.month);
  return { ...d, day: Math.min(Math.max(1, d.day), maxDay) };
}

export function defaultBirthDate(now: Date = new Date()): ExploreBirthDate {
  const year = Math.min(1990, now.getFullYear());
  return clampBirthDateToToday({ year: Math.max(1900, year), month: 1, day: 1 }, now);
}

export function buildBirthYearOptions(nowYear: number): number[] {
  const years: number[] = [];
  for (let y = nowYear; y >= 1900; y -= 1) years.push(y);
  return years;
}

export function buildBirthMonthOptions(year: number, now: Date = new Date()): number[] {
  const maxMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  return Array.from({ length: maxMonth }, (_, i) => i + 1);
}

export function buildBirthDayOptions(year: number, month: number, now: Date = new Date()): number[] {
  const n =
    year === now.getFullYear() && month === now.getMonth() + 1
      ? now.getDate()
      : daysInMonth(year, month);
  return Array.from({ length: n }, (_, i) => i + 1);
}

/** 不允许选今天之后的生日 */
export function clampBirthDateToToday(d: ExploreBirthDate, now: Date = new Date()): ExploreBirthDate {
  let next = clampBirthDate(d);
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const dToday = now.getDate();
  if (next.year > y) next = { ...next, year: y };
  if (next.year === y && next.month > m) next = { ...next, month: m };
  if (next.year === y && next.month === m && next.day > dToday) next = { ...next, day: dToday };
  return clampBirthDate(next);
}

const MS_PER_DAY = 86_400_000;

/** 自生日至今天（按日历日）已过的整天数（生日当天为 0） */
export function birthDateDaysLived(d: ExploreBirthDate, now: Date = new Date()): number {
  const birthUtc = Date.UTC(d.year, d.month - 1, d.day);
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((nowUtc - birthUtc) / MS_PER_DAY));
}

/** 生命的第几天（生日当天为第 1 天） */
export function birthDateLifeDay(d: ExploreBirthDate, now: Date = new Date()): number {
  return birthDateDaysLived(d, now) + 1;
}

/** 周岁（是否已过当年生日） */
export function birthDateAgeYears(d: ExploreBirthDate, now: Date = new Date()): number {
  let age = now.getFullYear() - d.year;
  const nowKey = (now.getMonth() + 1) * 100 + now.getDate();
  const birthKey = d.month * 100 + d.day;
  if (nowKey < birthKey) age -= 1;
  return Math.max(0, age);
}

export function formatExploreBirthDateLabel(d: ExploreBirthDate, locale: string): string {
  if (locale === "zh-CN") return `${d.year}年${d.month}月${d.day}日`;
  return `${d.month}/${d.day}/${d.year}`;
}
