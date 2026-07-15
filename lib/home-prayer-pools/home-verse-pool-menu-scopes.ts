import {
  OLD_TESTAMENT_MAX_BOOK_NUMBER,
  scriptureBooks,
  testamentForBookNumber,
} from "@/lib/bible/scripture-books";
import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { EXPLORE_CURATED_700_POOL_SCOPE_ID } from "@/lib/scripture/explore-curated-pool-scope-id";
import {
  DEFAULT_THEME_REPEAT_MIN_COUNT,
  themeRepeatPoolScopeId,
} from "@/lib/scripture/theme-repeat-pool-scope-id";
import { HOME_VERSE_POOL_MENU_COUNTS } from "@/lib/home-prayer-pools/home-verse-pool-menu-counts.generated";

/** 用户菜单「主页经文池」可选范围（持久化 ID）。 */
export type HomeVersePoolMenuScopeId =
  | "curated700"
  | "repeatGe5All"
  | "repeatGe5Old"
  | "repeatGe5New"
  | "repeatGe5Gospels"
  | "repeatGe5Epistles"
  | "repeatGe5Pentateuch"
  | "repeatGe5Wisdom"
  | "repeatGe5OldOther"
  | `repeatGe5Book:${string}`;

export const DEFAULT_HOME_VERSE_POOL_MENU_SCOPE: HomeVersePoolMenuScopeId = "curated700";

export const THEME_REPEAT_GE5_MENU_MIN_COUNT = DEFAULT_THEME_REPEAT_MIN_COUNT;

export const THEME_REPEAT_GE5_POOL_SCOPE_ID = themeRepeatPoolScopeId(THEME_REPEAT_GE5_MENU_MIN_COUNT);

const BOOK_SCOPE_PREFIX = "repeatGe5Book:" as const;

const bookIdSet = new Set(scriptureBooks.map((b) => b.bookId));

const GOSPEL_BOOK_IDS = new Set(["MAT", "MRK", "LUK", "JHN"]);
const EPISTLE_BOOK_IDS = new Set([
  "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM",
  "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD",
]);
const PENTATEUCH_BOOK_IDS = new Set(["GEN", "EXO", "LEV", "NUM", "DEU"]);
const WISDOM_BOOK_IDS = new Set(["JOB", "PSA", "PRO", "ECC", "SNG"]);

function bookIdsForGroupedScope(menuScope: HomeVersePoolMenuScopeId): Set<string> | null {
  if (menuScope === "repeatGe5Gospels") return GOSPEL_BOOK_IDS;
  if (menuScope === "repeatGe5Epistles") return EPISTLE_BOOK_IDS;
  if (menuScope === "repeatGe5Pentateuch") return PENTATEUCH_BOOK_IDS;
  if (menuScope === "repeatGe5Wisdom") return WISDOM_BOOK_IDS;
  if (menuScope === "repeatGe5OldOther") {
    return new Set(
      scriptureBooks
        .filter((book) => testamentForBookNumber(book.bookNumber) === "old")
        .map((book) => book.bookId)
        .filter((bookId) => !PENTATEUCH_BOOK_IDS.has(bookId) && !WISDOM_BOOK_IDS.has(bookId)),
    );
  }
  return null;
}

function localizeMenuText(locale: AppLocale, zh: string): string {
  if (locale === "en") {
    const enMap: Record<string, string> = {
      全部: "All",
      新旧约全部: "Old & New Testaments",
      默认经文池: "Default selection",
      旧约: "Old Testament",
      新约: "New Testament",
      福音书: "Gospels",
      书信: "Epistles",
      摩西五经: "Pentateuch",
      智慧书: "Wisdom Books",
      其它: "Other",
    };
    return enMap[zh] ?? zh;
  }
  return locale === "zh-TW" ? toZhTwText(zh) : zh;
}

function localizeBookName(locale: AppLocale, bookName: string, bookId: string): string {
  if (locale === "en") return bookId;
  return locale === "zh-TW" ? toZhTwText(bookName) : bookName;
}

export function isHomeVersePoolMenuScopeId(raw: string): raw is HomeVersePoolMenuScopeId {
  if (
    raw === "curated700" ||
    raw === "repeatGe5All" ||
    raw === "repeatGe5Old" ||
    raw === "repeatGe5New" ||
    raw === "repeatGe5Gospels" ||
    raw === "repeatGe5Epistles" ||
    raw === "repeatGe5Pentateuch" ||
    raw === "repeatGe5Wisdom" ||
    raw === "repeatGe5OldOther"
  ) {
    return true;
  }
  if (!raw.startsWith(BOOK_SCOPE_PREFIX)) return false;
  const bookId = raw.slice(BOOK_SCOPE_PREFIX.length).trim().toUpperCase();
  return bookIdSet.has(bookId);
}

export function parseHomeVersePoolMenuScopeId(raw: string | null | undefined): HomeVersePoolMenuScopeId {
  const v = String(raw ?? "").trim();
  if (isHomeVersePoolMenuScopeId(v)) return v;
  if (v === "all") return "repeatGe5All";
  return DEFAULT_HOME_VERSE_POOL_MENU_SCOPE;
}

export function staticPoolScopeIdForMenuScope(menuScope: HomeVersePoolMenuScopeId): string {
  if (menuScope === "curated700") return EXPLORE_CURATED_700_POOL_SCOPE_ID;
  return THEME_REPEAT_GE5_POOL_SCOPE_ID;
}

export function memoryNamespaceFromMenuScope(menuScope: HomeVersePoolMenuScopeId): string {
  return `menu:${menuScope}`;
}

function appendCount(label: string, count: number, locale: AppLocale): string {
  return locale === "en" ? `${label} (${count})` : `${label}（${count}）`;
}

export function menuScopeVerseCount(menuScope: HomeVersePoolMenuScopeId): number {
  if (menuScope === "curated700") return HOME_VERSE_POOL_MENU_COUNTS.curated700;
  if (menuScope === "repeatGe5All") return HOME_VERSE_POOL_MENU_COUNTS.repeatGe5All;
  if (menuScope === "repeatGe5Old") return HOME_VERSE_POOL_MENU_COUNTS.repeatGe5Old;
  if (menuScope === "repeatGe5New") return HOME_VERSE_POOL_MENU_COUNTS.repeatGe5New;
  const groupedBookIds = bookIdsForGroupedScope(menuScope);
  if (groupedBookIds) {
    return Array.from(groupedBookIds).reduce(
      (total, bookId) => total + (HOME_VERSE_POOL_MENU_COUNTS.books[bookId] ?? 0),
      0,
    );
  }
  if (menuScope.startsWith(BOOK_SCOPE_PREFIX)) {
    const bookId = menuScope.slice(BOOK_SCOPE_PREFIX.length).toUpperCase();
    return HOME_VERSE_POOL_MENU_COUNTS.books[bookId] ?? 0;
  }
  return 0;
}

export function resolveHomeVersePoolMenuLabel(
  menuScope: HomeVersePoolMenuScopeId,
  locale: AppLocale,
): string {
  if (menuScope === "curated700") {
    const label = locale === "en" ? "Default selection" : locale === "zh-TW" ? toZhTwText("默认精选") : "默认精选";
    return appendCount(label, menuScopeVerseCount(menuScope), locale);
  }
  if (menuScope === "repeatGe5All") {
    return appendCount(localizeMenuText(locale, "新旧约全部"), menuScopeVerseCount(menuScope), locale);
  }
  if (menuScope === "repeatGe5Old") {
    return appendCount(localizeMenuText(locale, "旧约"), menuScopeVerseCount(menuScope), locale);
  }
  if (menuScope === "repeatGe5New") {
    return appendCount(localizeMenuText(locale, "新约"), menuScopeVerseCount(menuScope), locale);
  }
  const groupedLabels: Partial<Record<HomeVersePoolMenuScopeId, string>> = {
    repeatGe5Gospels: "福音书",
    repeatGe5Epistles: "书信",
    repeatGe5Pentateuch: "摩西五经",
    repeatGe5Wisdom: "智慧书",
    repeatGe5OldOther: "其它",
  };
  const groupedLabel = groupedLabels[menuScope];
  if (groupedLabel) {
    return appendCount(localizeMenuText(locale, groupedLabel), menuScopeVerseCount(menuScope), locale);
  }
  if (menuScope.startsWith(BOOK_SCOPE_PREFIX)) {
    const bookId = menuScope.slice(BOOK_SCOPE_PREFIX.length).toUpperCase();
    const book = scriptureBooks.find((b) => b.bookId === bookId);
    const name = localizeBookName(locale, book?.bookName ?? bookId, bookId);
    return appendCount(name, menuScopeVerseCount(menuScope), locale);
  }
  return resolveHomeVersePoolMenuLabel(DEFAULT_HOME_VERSE_POOL_MENU_SCOPE, locale);
}

export type HomeVersePoolMenuRow =
  | { kind: "header"; label: string }
  | { kind: "option"; scopeId: HomeVersePoolMenuScopeId; label: string; indent?: 1 };

export function buildHomeVersePoolMenuRows(locale: AppLocale): HomeVersePoolMenuRow[] {
  const rows: HomeVersePoolMenuRow[] = [
    { kind: "option", scopeId: "repeatGe5All", label: resolveHomeVersePoolMenuLabel("repeatGe5All", locale) },
    { kind: "option", scopeId: "curated700", label: resolveHomeVersePoolMenuLabel("curated700", locale) },
    { kind: "header", label: localizeMenuText(locale, "新约") },
    { kind: "option", scopeId: "repeatGe5New", label: resolveHomeVersePoolMenuLabel("repeatGe5New", locale) },
  ];
  appendGroupedScopeRow(rows, locale, "repeatGe5Gospels");
  appendGroupedScopeRow(rows, locale, "repeatGe5Epistles");
  rows.push({ kind: "header", label: localizeMenuText(locale, "旧约") });
  rows.push({ kind: "option", scopeId: "repeatGe5Old", label: resolveHomeVersePoolMenuLabel("repeatGe5Old", locale) });
  appendGroupedScopeRow(rows, locale, "repeatGe5Pentateuch");
  appendGroupedScopeRow(rows, locale, "repeatGe5Wisdom");
  appendGroupedScopeRow(rows, locale, "repeatGe5OldOther");
  return rows;
}

function appendGroupedScopeRow(
  rows: HomeVersePoolMenuRow[],
  locale: AppLocale,
  groupedScope: HomeVersePoolMenuScopeId,
): void {
  rows.push({ kind: "option", scopeId: groupedScope, label: resolveHomeVersePoolMenuLabel(groupedScope, locale), indent: 1 });
}

export function bookIdFromMenuScope(menuScope: HomeVersePoolMenuScopeId): string | null {
  if (!menuScope.startsWith(BOOK_SCOPE_PREFIX)) return null;
  return menuScope.slice(BOOK_SCOPE_PREFIX.length).toUpperCase();
}

export function menuScopeMatchesVerseKey(menuScope: HomeVersePoolMenuScopeId, verseKey: string): boolean {
  const m = /^([A-Z0-9]{3})\./.exec(verseKey.trim().toUpperCase());
  if (!m) return false;
  const bookId = m[1]!;
  const book = scriptureBooks.find((b) => b.bookId === bookId);
  if (!book) return false;
  if (menuScope === "repeatGe5All") return true;
  if (menuScope === "repeatGe5Old") return book.bookNumber <= OLD_TESTAMENT_MAX_BOOK_NUMBER;
  if (menuScope === "repeatGe5New") return book.bookNumber > OLD_TESTAMENT_MAX_BOOK_NUMBER;
  const groupedBookIds = bookIdsForGroupedScope(menuScope);
  if (groupedBookIds) return groupedBookIds.has(bookId);
  const scopedBookId = bookIdFromMenuScope(menuScope);
  return scopedBookId != null && scopedBookId === bookId;
}
