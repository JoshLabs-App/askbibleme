import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import type { AppLocale } from "../i18n/config";
import { getLocale } from "../i18n/locale-store";

/** 上古等时代：寿命进度条满格刻度（岁） */
export const BIBLICAL_LIFESPAN_SCALE_YEARS = 1000;

/** 新约 / 今天：单独刻度（岁） */
export const BIBLICAL_LIFESPAN_NT_SCALE_YEARS = 100;

export const BIBLICAL_LIFESPAN_MODERN_ERA = "今天";
const BIBLICAL_LIFESPAN_MODERN_ERA_EN = "Today";

/** 简化时代（图表左侧六类） */
export const BIBLICAL_LIFESPAN_ERA = {
  preFlood: "大洪水前时代",
  postFlood: "大洪水后时代",
  patriarchs: "列祖时代",
  law: "律法时期",
  kingdom: "王国时代",
  newTestament: "新约时代",
} as const;

export type BiblicalLifespanEntry = {
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

/** 圣经次序（亚当 → 新约）；年寿图展示用倒序 */
const BIBLICAL_LIFESPANS_CHRONOLOGICAL: BiblicalLifespanEntry[] = [
  { id: "gen-adam", era: BIBLICAL_LIFESPAN_ERA.preFlood, name: "亚当", lifespanDisplay: "930岁", years: 930, refDisplay: "创世记 5:5", bookId: "GEN", chapter: 5, verseStart: 5 },
  { id: "gen-seth", era: BIBLICAL_LIFESPAN_ERA.preFlood, name: "塞特", lifespanDisplay: "912岁", years: 912, refDisplay: "创世记 5:8", bookId: "GEN", chapter: 5, verseStart: 8 },
  { id: "gen-enosh", era: BIBLICAL_LIFESPAN_ERA.preFlood, name: "以挪士", lifespanDisplay: "905岁", years: 905, refDisplay: "创世记 5:11", bookId: "GEN", chapter: 5, verseStart: 11 },
  { id: "gen-kenan", era: BIBLICAL_LIFESPAN_ERA.preFlood, name: "该南", lifespanDisplay: "910岁", years: 910, refDisplay: "创世记 5:14", bookId: "GEN", chapter: 5, verseStart: 14 },
  { id: "gen-mahalalel", era: BIBLICAL_LIFESPAN_ERA.preFlood, name: "玛勒列", lifespanDisplay: "895岁", years: 895, refDisplay: "创世记 5:17", bookId: "GEN", chapter: 5, verseStart: 17 },
  { id: "gen-jared", era: BIBLICAL_LIFESPAN_ERA.preFlood, name: "雅列", lifespanDisplay: "962岁", years: 962, refDisplay: "创世记 5:20", bookId: "GEN", chapter: 5, verseStart: 20 },
  { id: "gen-enoch", era: BIBLICAL_LIFESPAN_ERA.preFlood, name: "以诺", lifespanDisplay: "365岁", years: 365, refDisplay: "创世记 5:23-24", bookId: "GEN", chapter: 5, verseStart: 23, verseEnd: 24 },
  { id: "gen-methuselah", era: BIBLICAL_LIFESPAN_ERA.preFlood, name: "玛土撒拉", lifespanDisplay: "969岁", years: 969, refDisplay: "创世记 5:27", bookId: "GEN", chapter: 5, verseStart: 27 },
  { id: "gen-lamech", era: BIBLICAL_LIFESPAN_ERA.preFlood, name: "拉麦", lifespanDisplay: "777岁", years: 777, refDisplay: "创世记 5:31", bookId: "GEN", chapter: 5, verseStart: 31 },
  { id: "gen-noah", era: BIBLICAL_LIFESPAN_ERA.postFlood, name: "挪亚", lifespanDisplay: "950岁", years: 950, refDisplay: "创世记 9:29", bookId: "GEN", chapter: 9, verseStart: 29 },
  { id: "gen-shem", era: BIBLICAL_LIFESPAN_ERA.postFlood, name: "闪", lifespanDisplay: "600岁", years: 600, refDisplay: "创世记 11:10-11", bookId: "GEN", chapter: 11, verseStart: 10, verseEnd: 11 },
  { id: "gen-arpachshad", era: BIBLICAL_LIFESPAN_ERA.postFlood, name: "亚法撒", lifespanDisplay: "438岁", years: 438, refDisplay: "创世记 11:12-13", bookId: "GEN", chapter: 11, verseStart: 12, verseEnd: 13 },
  { id: "gen-shelah", era: BIBLICAL_LIFESPAN_ERA.postFlood, name: "沙拉", lifespanDisplay: "433岁", years: 433, refDisplay: "创世记 11:14-15", bookId: "GEN", chapter: 11, verseStart: 14, verseEnd: 15 },
  { id: "gen-eber", era: BIBLICAL_LIFESPAN_ERA.postFlood, name: "希伯", lifespanDisplay: "464岁", years: 464, refDisplay: "创世记 11:16-17", bookId: "GEN", chapter: 11, verseStart: 16, verseEnd: 17 },
  { id: "gen-peleg", era: BIBLICAL_LIFESPAN_ERA.postFlood, name: "法勒", lifespanDisplay: "239岁", years: 239, refDisplay: "创世记 11:18-19", bookId: "GEN", chapter: 11, verseStart: 18, verseEnd: 19 },
  { id: "gen-reu", era: BIBLICAL_LIFESPAN_ERA.postFlood, name: "拉吴", lifespanDisplay: "239岁", years: 239, refDisplay: "创世记 11:20-21", bookId: "GEN", chapter: 11, verseStart: 20, verseEnd: 21 },
  { id: "gen-serug", era: BIBLICAL_LIFESPAN_ERA.postFlood, name: "西鹿", lifespanDisplay: "230岁", years: 230, refDisplay: "创世记 11:22-23", bookId: "GEN", chapter: 11, verseStart: 22, verseEnd: 23 },
  { id: "gen-nahor", era: BIBLICAL_LIFESPAN_ERA.postFlood, name: "拿鹤", lifespanDisplay: "148岁", years: 148, refDisplay: "创世记 11:24-25", bookId: "GEN", chapter: 11, verseStart: 24, verseEnd: 25 },
  { id: "gen-terah", era: BIBLICAL_LIFESPAN_ERA.patriarchs, name: "他拉", lifespanDisplay: "205岁", years: 205, refDisplay: "创世记 11:32", bookId: "GEN", chapter: 11, verseStart: 32 },
  { id: "gen-sarah", era: BIBLICAL_LIFESPAN_ERA.patriarchs, name: "撒拉", lifespanDisplay: "127岁", years: 127, refDisplay: "创世记 23:1", bookId: "GEN", chapter: 23, verseStart: 1 },
  { id: "gen-abraham", era: BIBLICAL_LIFESPAN_ERA.patriarchs, name: "亚伯拉罕", lifespanDisplay: "175岁", years: 175, refDisplay: "创世记 25:7", bookId: "GEN", chapter: 25, verseStart: 7 },
  { id: "gen-ishmael", era: BIBLICAL_LIFESPAN_ERA.patriarchs, name: "以实玛利", lifespanDisplay: "137岁", years: 137, refDisplay: "创世记 25:17", bookId: "GEN", chapter: 25, verseStart: 17 },
  { id: "gen-isaac", era: BIBLICAL_LIFESPAN_ERA.patriarchs, name: "以撒", lifespanDisplay: "180岁", years: 180, refDisplay: "创世记 35:28", bookId: "GEN", chapter: 35, verseStart: 28 },
  { id: "gen-jacob", era: BIBLICAL_LIFESPAN_ERA.patriarchs, name: "雅各", lifespanDisplay: "147岁", years: 147, refDisplay: "创世记 47:28", bookId: "GEN", chapter: 47, verseStart: 28 },
  { id: "gen-joseph", era: BIBLICAL_LIFESPAN_ERA.patriarchs, name: "约瑟", lifespanDisplay: "110岁", years: 110, refDisplay: "创世记 50:26", bookId: "GEN", chapter: 50, verseStart: 26 },
  { id: "exo-levi", era: BIBLICAL_LIFESPAN_ERA.law, name: "利未", lifespanDisplay: "137岁", years: 137, refDisplay: "出埃及记 6:16", bookId: "EXO", chapter: 6, verseStart: 16 },
  { id: "exo-kohath", era: BIBLICAL_LIFESPAN_ERA.law, name: "哥辖", lifespanDisplay: "133岁", years: 133, refDisplay: "出埃及记 6:18", bookId: "EXO", chapter: 6, verseStart: 18 },
  { id: "exo-amram", era: BIBLICAL_LIFESPAN_ERA.law, name: "暗兰", lifespanDisplay: "137岁", years: 137, refDisplay: "出埃及记 6:20", bookId: "EXO", chapter: 6, verseStart: 20 },
  { id: "num-aaron", era: BIBLICAL_LIFESPAN_ERA.law, name: "亚伦", lifespanDisplay: "123岁", years: 123, refDisplay: "民数记 33:39", bookId: "NUM", chapter: 33, verseStart: 39 },
  { id: "deu-moses", era: BIBLICAL_LIFESPAN_ERA.law, name: "摩西", lifespanDisplay: "120岁", years: 120, refDisplay: "申命记 34:7", bookId: "DEU", chapter: 34, verseStart: 7 },
  { id: "jos-joshua", era: BIBLICAL_LIFESPAN_ERA.law, name: "约书亚", lifespanDisplay: "110岁", years: 110, refDisplay: "约书亚记 24:29", bookId: "JOS", chapter: 24, verseStart: 29 },
  { id: "1sa-eli", era: BIBLICAL_LIFESPAN_ERA.kingdom, name: "以利", lifespanDisplay: "98岁", years: 98, refDisplay: "撒母耳记上 4:15", bookId: "1SA", chapter: 4, verseStart: 15 },
  { id: "2sa-david", era: BIBLICAL_LIFESPAN_ERA.kingdom, name: "大卫", lifespanDisplay: "70岁", years: 70, refDisplay: "撒母耳记下 5:4", bookId: "2SA", chapter: 5, verseStart: 4 },
  { id: "luk-jesus", era: BIBLICAL_LIFESPAN_ERA.newTestament, name: "耶稣", lifespanDisplay: "33年", years: 33, refDisplay: "路加福音 3:23", bookId: "LUK", chapter: 3, verseStart: 23 },
  { id: "mat-john", era: BIBLICAL_LIFESPAN_ERA.newTestament, name: "约翰", lifespanDisplay: "90岁以上", years: 90, refDisplay: "马太福音 10:2；传统记载", bookId: "MAT", chapter: 10, verseStart: 2 },
  { id: "mat-philip", era: BIBLICAL_LIFESPAN_ERA.newTestament, name: "腓力", lifespanDisplay: "约87岁", years: 87, refDisplay: "马太福音 10:3；传统记载", bookId: "MAT", chapter: 10, verseStart: 3 },
  { id: "mat-matthew", era: BIBLICAL_LIFESPAN_ERA.newTestament, name: "马太", lifespanDisplay: "约74岁", years: 74, refDisplay: "马太福音 10:3；传统记载", bookId: "MAT", chapter: 10, verseStart: 3 },
  { id: "mat-simon-zealot", era: BIBLICAL_LIFESPAN_ERA.newTestament, name: "奋锐党西门", lifespanDisplay: "约74岁", years: 74, refDisplay: "马太福音 10:4；传统记载", bookId: "MAT", chapter: 10, verseStart: 4 },
  { id: "mat-thomas", era: BIBLICAL_LIFESPAN_ERA.newTestament, name: "多马", lifespanDisplay: "约72岁", years: 72, refDisplay: "马太福音 10:3；传统记载", bookId: "MAT", chapter: 10, verseStart: 3 },
  { id: "mat-bartholomew", era: BIBLICAL_LIFESPAN_ERA.newTestament, name: "巴多罗买", lifespanDisplay: "约70岁", years: 70, refDisplay: "马太福音 10:3；传统记载", bookId: "MAT", chapter: 10, verseStart: 3 },
  { id: "mat-thaddaeus", era: BIBLICAL_LIFESPAN_ERA.newTestament, name: "达太", lifespanDisplay: "约70岁", years: 70, refDisplay: "马太福音 10:3；传统记载", bookId: "MAT", chapter: 10, verseStart: 3 },
  { id: "mat-peter", era: BIBLICAL_LIFESPAN_ERA.newTestament, name: "彼得", lifespanDisplay: "约67岁", years: 67, refDisplay: "马太福音 10:2；传统记载", bookId: "MAT", chapter: 10, verseStart: 2 },
  { id: "mat-andrew", era: BIBLICAL_LIFESPAN_ERA.newTestament, name: "安得烈", lifespanDisplay: "约62岁", years: 62, refDisplay: "马太福音 10:2；传统记载", bookId: "MAT", chapter: 10, verseStart: 2 },
  { id: "mat-james-alphaeus", era: BIBLICAL_LIFESPAN_ERA.newTestament, name: "小雅各", lifespanDisplay: "约61岁", years: 61, refDisplay: "马太福音 10:3；传统记载", bookId: "MAT", chapter: 10, verseStart: 3 },
  { id: "act-james-zebedee", era: BIBLICAL_LIFESPAN_ERA.newTestament, name: "雅各", lifespanDisplay: "约44岁", years: 44, refDisplay: "使徒行传 12:2；传统记载", bookId: "ACT", chapter: 12, verseStart: 2 },
];

export const BIBLICAL_LIFESPANS: BiblicalLifespanEntry[] = [...BIBLICAL_LIFESPANS_CHRONOLOGICAL].reverse();

export function isBiblicalLifespanNewTestamentEra(era: string): boolean {
  return era === BIBLICAL_LIFESPAN_ERA.newTestament || era === EN_ERA_BY_ZH[BIBLICAL_LIFESPAN_ERA.newTestament];
}

export function biblicalLifespanBarWidthPct(
  years: number,
  scaleYears: number = BIBLICAL_LIFESPAN_SCALE_YEARS,
): number {
  if (scaleYears <= 0) return 0;
  return Math.min(100, Math.max(0, (years / scaleYears) * 100));
}

const EN_ERA_BY_ZH: Record<string, string> = {
  [BIBLICAL_LIFESPAN_ERA.preFlood]: "Before the Flood",
  [BIBLICAL_LIFESPAN_ERA.postFlood]: "After the Flood",
  [BIBLICAL_LIFESPAN_ERA.patriarchs]: "Patriarchs",
  [BIBLICAL_LIFESPAN_ERA.law]: "Law",
  [BIBLICAL_LIFESPAN_ERA.kingdom]: "Kingdom",
  [BIBLICAL_LIFESPAN_ERA.newTestament]: "New Testament",
};

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function englishNameForEntry(entry: BiblicalLifespanEntry): string {
  const parts = entry.id.split("-");
  return titleFromSlug(parts.slice(1).join("-"));
}

function englishRefForEntry(entry: BiblicalLifespanEntry): string {
  const range = entry.verseEnd && entry.verseEnd > entry.verseStart ? `${entry.verseStart}-${entry.verseEnd}` : `${entry.verseStart}`;
  const base = `${getScriptureBookDisplayName(entry.bookId, "en")} ${entry.chapter}:${range}`;
  return entry.refDisplay.includes("传统记载") ? `${base} (traditional record)` : base;
}

function toEnglishEntry(entry: BiblicalLifespanEntry): BiblicalLifespanEntry {
  return {
    ...entry,
    era: EN_ERA_BY_ZH[entry.era] ?? entry.era,
    name: englishNameForEntry(entry),
    lifespanDisplay: `${entry.years} years`,
    refDisplay: englishRefForEntry(entry),
  };
}

const BIBLICAL_LIFESPANS_EN: BiblicalLifespanEntry[] = BIBLICAL_LIFESPANS.map(toEnglishEntry);

export function getBiblicalLifespanModernEra(locale: AppLocale = getLocale()): string {
  return locale === "en" ? BIBLICAL_LIFESPAN_MODERN_ERA_EN : BIBLICAL_LIFESPAN_MODERN_ERA;
}

export function getBiblicalLifespans(locale: AppLocale = getLocale()): BiblicalLifespanEntry[] {
  return locale === "en" ? BIBLICAL_LIFESPANS_EN : BIBLICAL_LIFESPANS;
}
