import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import type { AppLocale } from "../i18n/config";
import { getLocale } from "../i18n/locale-store";
import { localizeZhText } from "../i18n/site-copy";
import { getExploreModulesContent } from "./exploreModuleContent";

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

const BIBLICAL_LIFESPAN_MODERN_ERA_EN = "Today";

function biblicalConfig() {
  return getExploreModulesContent().biblicalLifespans;
}

export function getBiblicalLifespanScaleYears(): number {
  return biblicalConfig().scaleYears;
}

export function getBiblicalLifespanNtScaleYears(): number {
  return biblicalConfig().ntScaleYears;
}

export function getBiblicalLifespanModernEraLabel(): string {
  return biblicalConfig().modernEra;
}

export function getBiblicalLifespanEra(): Record<string, string> {
  return biblicalConfig().era;
}

function baseLifespans(): BiblicalLifespanEntry[] {
  return biblicalConfig().lifespans;
}

export function isBiblicalLifespanNewTestamentEra(era: string): boolean {
  const nt = getBiblicalLifespanEra().newTestament;
  if (!nt) return false;
  return era === nt || era === EN_ERA_BY_ZH[nt];
}

export function biblicalLifespanBarWidthPct(
  years: number,
  scaleYears: number = getBiblicalLifespanScaleYears(),
): number {
  if (scaleYears <= 0) return 0;
  return Math.min(100, Math.max(0, (years / scaleYears) * 100));
}

const EN_ERA_BY_ZH: Record<string, string> = {
  "大洪水前时代": "Before the Flood",
  "大洪水后时代": "After the Flood",
  "列祖时代": "Patriarchs",
  "律法时期": "Law",
  "王国时代": "Kingdom",
  "新约时代": "New Testament",
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

function toTraditionalEntry(entry: BiblicalLifespanEntry): BiblicalLifespanEntry {
  return {
    ...entry,
    era: localizeZhText("zh-TW", entry.era),
    name: localizeZhText("zh-TW", entry.name),
    lifespanDisplay: localizeZhText("zh-TW", entry.lifespanDisplay),
    refDisplay: localizeZhText("zh-TW", entry.refDisplay),
  };
}

export function getBiblicalLifespanModernEra(locale: AppLocale = getLocale()): string {
  if (locale === "en") return BIBLICAL_LIFESPAN_MODERN_ERA_EN;
  return localizeZhText(locale, getBiblicalLifespanModernEraLabel());
}

export function getBiblicalLifespans(locale: AppLocale = getLocale()): BiblicalLifespanEntry[] {
  const rows = baseLifespans();
  if (locale === "en") return rows.map(toEnglishEntry);
  if (locale === "zh-TW") return rows.map(toTraditionalEntry);
  return rows;
}
