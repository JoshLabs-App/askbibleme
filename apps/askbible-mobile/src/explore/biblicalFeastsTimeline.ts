import { t } from "../i18n/site-copy";

export type FeastReadTarget = {
  label: string;
  bookId: string;
  chapter: number;
  verse: number;
};

const ZH_BOOK_LABELS: Record<string, string> = {
  MAT: "太",
  MRK: "可",
  LUK: "路",
  JHN: "约",
  ACT: "徒",
  ROM: "罗",
  "1CO": "林前",
  "1TH": "帖前",
  HEB: "来",
  JAS: "雅",
  REV: "启",
  EXO: "出",
  LEV: "利",
  NUM: "民",
  PSA: "诗",
  ISA: "赛",
  JOL: "珥",
  ZEC: "亚",
};

export function formatReadTargetLabel(target: FeastReadTarget, locale: string): string {
  if (!/^zh\b/i.test(locale)) return target.label;
  const book = ZH_BOOK_LABELS[target.bookId] ?? target.bookId;
  return `${book} ${target.chapter}:${target.verse}`;
}

export type FeastTimelineItem = {
  id: string;
  season: "spring" | "autumn" | "church";
  orderLabel: string;
  readTargets: FeastReadTarget[];
};

export const BIBLICAL_FEAST_TIMELINE: FeastTimelineItem[] = [
  {
    id: "passover",
    season: "spring",
    orderLabel: "01",
    readTargets: [
      { label: "LEV 23:5", bookId: "LEV", chapter: 23, verse: 5 },
      { label: "EXO 12:13", bookId: "EXO", chapter: 12, verse: 13 },
      { label: "JHN 1:29", bookId: "JHN", chapter: 1, verse: 29 },
    ],
  },
  {
    id: "unleavened-bread",
    season: "spring",
    orderLabel: "02",
    readTargets: [
      { label: "LEV 23:6", bookId: "LEV", chapter: 23, verse: 6 },
      { label: "EXO 12:15", bookId: "EXO", chapter: 12, verse: 15 },
      { label: "1CO 5:7", bookId: "1CO", chapter: 5, verse: 7 },
    ],
  },
  {
    id: "firstfruits",
    season: "spring",
    orderLabel: "03",
    readTargets: [
      { label: "LEV 23:10", bookId: "LEV", chapter: 23, verse: 10 },
      { label: "1CO 15:20", bookId: "1CO", chapter: 15, verse: 20 },
      { label: "ROM 11:16", bookId: "ROM", chapter: 11, verse: 16 },
    ],
  },
  {
    id: "weeks-pentecost",
    season: "spring",
    orderLabel: "04",
    readTargets: [
      { label: "LEV 23:15", bookId: "LEV", chapter: 23, verse: 15 },
      { label: "ACT 2:1", bookId: "ACT", chapter: 2, verse: 1 },
      { label: "JAS 1:18", bookId: "JAS", chapter: 1, verse: 18 },
    ],
  },
  {
    id: "trumpets",
    season: "autumn",
    orderLabel: "05",
    readTargets: [
      { label: "LEV 23:24", bookId: "LEV", chapter: 23, verse: 24 },
      { label: "NUM 10:10", bookId: "NUM", chapter: 10, verse: 10 },
      { label: "1TH 4:16", bookId: "1TH", chapter: 4, verse: 16 },
    ],
  },
  {
    id: "atonement",
    season: "autumn",
    orderLabel: "06",
    readTargets: [
      { label: "LEV 23:27", bookId: "LEV", chapter: 23, verse: 27 },
      { label: "LEV 16:30", bookId: "LEV", chapter: 16, verse: 30 },
      { label: "HEB 9:12", bookId: "HEB", chapter: 9, verse: 12 },
    ],
  },
  {
    id: "tabernacles",
    season: "autumn",
    orderLabel: "07",
    readTargets: [
      { label: "LEV 23:34", bookId: "LEV", chapter: 23, verse: 34 },
      { label: "JHN 1:14", bookId: "JHN", chapter: 1, verse: 14 },
      { label: "REV 21:3", bookId: "REV", chapter: 21, verse: 3 },
    ],
  },
];

export const CHURCH_FEAST_TIMELINE: FeastTimelineItem[] = [
  {
    id: "advent",
    season: "church",
    orderLabel: "01",
    readTargets: [
      { label: "MAT 24:42", bookId: "MAT", chapter: 24, verse: 42 },
      { label: "ISA 9:2", bookId: "ISA", chapter: 9, verse: 2 },
      { label: "REV 22:20", bookId: "REV", chapter: 22, verse: 20 },
    ],
  },
  {
    id: "christmas",
    season: "church",
    orderLabel: "02",
    readTargets: [
      { label: "LUK 2:11", bookId: "LUK", chapter: 2, verse: 11 },
      { label: "ISA 9:6", bookId: "ISA", chapter: 9, verse: 6 },
      { label: "JHN 1:14", bookId: "JHN", chapter: 1, verse: 14 },
    ],
  },
  {
    id: "epiphany",
    season: "church",
    orderLabel: "03",
    readTargets: [
      { label: "MAT 2:1", bookId: "MAT", chapter: 2, verse: 1 },
      { label: "ISA 60:3", bookId: "ISA", chapter: 60, verse: 3 },
      { label: "JHN 8:12", bookId: "JHN", chapter: 8, verse: 12 },
    ],
  },
  {
    id: "ash-wednesday",
    season: "church",
    orderLabel: "04",
    readTargets: [
      { label: "JOE 2:12", bookId: "JOL", chapter: 2, verse: 12 },
      { label: "MAT 6:16", bookId: "MAT", chapter: 6, verse: 16 },
      { label: "PSA 51:10", bookId: "PSA", chapter: 51, verse: 10 },
    ],
  },
  {
    id: "lent",
    season: "church",
    orderLabel: "05",
    readTargets: [
      { label: "MAT 4:2", bookId: "MAT", chapter: 4, verse: 2 },
      { label: "LUK 9:23", bookId: "LUK", chapter: 9, verse: 23 },
      { label: "ISA 58:6", bookId: "ISA", chapter: 58, verse: 6 },
    ],
  },
  {
    id: "palm-sunday",
    season: "church",
    orderLabel: "06",
    readTargets: [
      { label: "MAT 21:9", bookId: "MAT", chapter: 21, verse: 9 },
      { label: "ZEC 9:9", bookId: "ZEC", chapter: 9, verse: 9 },
      { label: "JHN 12:13", bookId: "JHN", chapter: 12, verse: 13 },
    ],
  },
  {
    id: "good-friday",
    season: "church",
    orderLabel: "07",
    readTargets: [
      { label: "ISA 53:5", bookId: "ISA", chapter: 53, verse: 5 },
      { label: "JHN 19:30", bookId: "JHN", chapter: 19, verse: 30 },
      { label: "LUK 23:46", bookId: "LUK", chapter: 23, verse: 46 },
    ],
  },
  {
    id: "easter",
    season: "church",
    orderLabel: "08",
    readTargets: [
      { label: "MAT 28:6", bookId: "MAT", chapter: 28, verse: 6 },
      { label: "1CO 15:4", bookId: "1CO", chapter: 15, verse: 4 },
      { label: "JHN 11:25", bookId: "JHN", chapter: 11, verse: 25 },
    ],
  },
  {
    id: "ascension",
    season: "church",
    orderLabel: "09",
    readTargets: [
      { label: "ACT 1:9", bookId: "ACT", chapter: 1, verse: 9 },
      { label: "LUK 24:51", bookId: "LUK", chapter: 24, verse: 51 },
      { label: "HEB 4:14", bookId: "HEB", chapter: 4, verse: 14 },
    ],
  },
  {
    id: "pentecost-church",
    season: "church",
    orderLabel: "10",
    readTargets: [
      { label: "ACT 2:4", bookId: "ACT", chapter: 2, verse: 4 },
      { label: "JHN 14:26", bookId: "JHN", chapter: 14, verse: 26 },
      { label: "ROM 8:11", bookId: "ROM", chapter: 8, verse: 11 },
    ],
  },
];

export const BIBLICAL_FEASTS_BOTTOM_PAD = 140;

export type MappedFeastRow = FeastTimelineItem & {
  seasonLabel: string;
  month: string;
  title: string;
  date: string;
  scripture: string;
  summary: string;
  practice: string;
  fulfillment: string;
};

export function mapFeastTimelineRows(
  rows: FeastTimelineItem[],
  copyKey: "feasts" | "churchFeasts",
  springLabel: string,
  autumnLabel: string,
): MappedFeastRow[] {
  return rows.map((row) => ({
    ...row,
    seasonLabel: row.season === "spring" ? springLabel : autumnLabel,
    month: t(`pages.explore.biblicalFeasts.${copyKey}.${row.id}.month`),
    title: t(`pages.explore.biblicalFeasts.${copyKey}.${row.id}.title`),
    date: t(`pages.explore.biblicalFeasts.${copyKey}.${row.id}.date`),
    scripture: t(`pages.explore.biblicalFeasts.${copyKey}.${row.id}.scripture`),
    summary: t(`pages.explore.biblicalFeasts.${copyKey}.${row.id}.summary`),
    practice: t(`pages.explore.biblicalFeasts.${copyKey}.${row.id}.practice`),
    fulfillment: t(`pages.explore.biblicalFeasts.${copyKey}.${row.id}.fulfillment`),
  }));
}
