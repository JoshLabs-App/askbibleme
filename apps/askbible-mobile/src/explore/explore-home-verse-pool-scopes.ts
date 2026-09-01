import { scriptureBooks } from "@/lib/bible/scripture-books";
import { getExploreModulesContent } from "./exploreModuleContent";
import { EXPLORE_HOME_VERSE_POOL_VERSE_KEYS } from "./explore-home-verse-pool-verse-keys";
import { getYearsDaysEternityZh } from "./years-days-eternity-content";
import type { YearsDaysEternityBlock } from "./years-days-eternity-types";
import type { AppLocale } from "../i18n/config";
import { localizeZhText } from "../i18n/site-copy";

export type HomeVersePoolScopeId =
  | "comprehensive"
  | "praise_worship"
  | "word_of_god"
  | "years_days_eternity"
  | "narrow_gate"
  | "prayer_scripture"
  | "all";

export type HomeVersePoolScopeOption = {
  id: HomeVersePoolScopeId;
  labelZh: string;
  labelEn: string;
};

export const HOME_VERSE_POOL_SCOPE_OPTIONS: HomeVersePoolScopeOption[] = [
  { id: "all", labelZh: "全部", labelEn: "All" },
  { id: "comprehensive", labelZh: "综合", labelEn: "Comprehensive" },
  { id: "praise_worship", labelZh: "赞美敬拜", labelEn: "Praise & Worship" },
  { id: "word_of_god", labelZh: "话语之光", labelEn: "Word of God" },
  { id: "years_days_eternity", labelZh: "年日与永恒", labelEn: "Years, Days & Eternity" },
  { id: "narrow_gate", labelZh: "窄门之路", labelEn: "Narrow Gate" },
  { id: "prayer_scripture", labelZh: "祷告与经文", labelEn: "Prayer & Scripture" },
];

export const DEFAULT_HOME_VERSE_POOL_SCOPE: HomeVersePoolScopeId = "all";

export function resolveHomeVersePoolScopeLabel(
  scope: HomeVersePoolScopeOption,
  locale: AppLocale,
): string {
  if (locale === "en") return scope.labelEn;
  return localizeZhText(locale, scope.labelZh);
}

type ParsedRef = { bookId: string; chapter: number; verseList: number[] };
type RefVersePart = { chapter: number; start: number; end: number };

function verseKey(bookId: string, chapter: number, verse: number): string {
  return `${bookId}.${chapter}.${verse}`;
}

function parseVerseList(spec: string): number[] {
  const values: number[] = [];
  const parts = spec.split(",").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
        for (let v = start; v <= end; v += 1) values.push(v);
      }
      continue;
    }
    const single = Number(part);
    if (Number.isInteger(single) && single >= 1) values.push(single);
  }
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function parseRefWithBookMap(raw: string, bookMap: Record<string, string>): ParsedRef | null {
  const normalized = raw.replace(/\s+/g, " ").trim();
  const m = normalized.match(/^(.+?)\s+(\d+):([0-9,\-]+)$/);
  if (!m) return null;
  const abbr = m[1].trim();
  const chapter = Number(m[2]);
  const verseLabel = m[3].trim();
  const bookId = bookMap[abbr];
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) return null;
  const verseList = parseVerseList(verseLabel);
  if (!verseList.length) return null;
  return { bookId, chapter, verseList };
}

function collectByCategories(
  categories: { refs: string[] }[],
  bookMap: Record<string, string>,
): Set<string> {
  const out = new Set<string>();
  for (const category of categories) {
    for (const ref of category.refs) {
      const parsed = parseRefWithBookMap(ref, bookMap);
      if (!parsed) continue;
      for (const verse of parsed.verseList) {
        out.add(verseKey(parsed.bookId, parsed.chapter, verse));
      }
    }
  }
  return out;
}

function parseZhRefParts(ref: string): { bookId: string; parts: RefVersePart[] } | null {
  const normalized = ref.replace(/\s+/g, " ").trim();
  const m = normalized.match(/^(.+?)\s+(\d+):(.+)$/);
  if (!m) return null;
  const bookName = m[1]?.trim();
  const baseChapter = Number(m[2]);
  const tail = m[3]?.trim() ?? "";
  if (!bookName || !Number.isInteger(baseChapter) || baseChapter < 1 || !tail) return null;
  const bookId = scriptureBooks.find((b) => b.bookName === bookName)?.bookId;
  if (!bookId) return null;

  const parts: RefVersePart[] = [];
  const segments = tail.split(",").map((x) => x.trim()).filter(Boolean);
  for (const seg of segments) {
    let chapter = baseChapter;
    let verseSpec = seg;
    if (seg.includes(":")) {
      const cm = seg.match(/^(\d+):(.+)$/);
      if (!cm) continue;
      chapter = Number(cm[1]);
      verseSpec = cm[2]?.trim() ?? "";
    }
    if (!Number.isInteger(chapter) || chapter < 1 || !verseSpec) continue;
    const rm = verseSpec.match(/^(\d+)-(\d+)$/);
    if (rm) {
      const start = Number(rm[1]);
      const end = Number(rm[2]);
      if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
        parts.push({ chapter, start, end });
      }
      continue;
    }
    const single = Number(verseSpec);
    if (Number.isInteger(single) && single >= 1) {
      parts.push({ chapter, start: single, end: single });
    }
  }
  if (!parts.length) return null;
  return { bookId, parts };
}

function collectYearsDaysEternityVerseKeys(): Set<string> {
  const out = new Set<string>();
  const scriptureRefs: string[] = [];
  const collectBlockRef = (blocks: YearsDaysEternityBlock[]) => {
    for (const block of blocks) {
      if (block.type === "scripture") scriptureRefs.push(block.ref);
    }
  };
  const yearsDaysEternityZh = getYearsDaysEternityZh();
  collectBlockRef(yearsDaysEternityZh.intro);
  for (const section of yearsDaysEternityZh.sections) collectBlockRef(section.blocks);
  scriptureRefs.push(yearsDaysEternityZh.finale.scripture.ref);

  for (const rawRef of scriptureRefs) {
    const parsed = parseZhRefParts(rawRef);
    if (!parsed) continue;
    for (const part of parsed.parts) {
      for (let v = part.start; v <= part.end; v += 1) {
        out.add(verseKey(parsed.bookId, part.chapter, v));
      }
    }
  }
  return out;
}

function collectPrayerScriptureVerseWeights(): Map<string, number> {
  const weights = new Map<string, number>();
  const prayer = getExploreModulesContent().prayer;
  for (const scenario of prayer.scenarios) {
    for (const ref of scenario.refs) {
      const parsed = parseRefWithBookMap(ref, prayer.bookAbbrToId);
      if (!parsed) continue;
      for (const verse of parsed.verseList) {
        const key = verseKey(parsed.bookId, parsed.chapter, verse);
        weights.set(key, (weights.get(key) ?? 0) + 1);
      }
    }
  }
  return weights;
}

function unionSets(...sets: Set<string>[]): Set<string> {
  const out = new Set<string>();
  for (const oneSet of sets) {
    for (const key of oneSet) out.add(key);
  }
  return out;
}

const modules = getExploreModulesContent();
const praiseWorshipKeys = collectByCategories(modules.praiseWorship.categories, modules.praiseWorship.bookAbbrToId);
const wordOfGodKeys = collectByCategories(modules.wordOfGod.categories, modules.wordOfGod.bookAbbrToId);
const yearsDaysEternityKeys = collectYearsDaysEternityVerseKeys();
const narrowGateKeys = collectByCategories(modules.narrowGate.categories, modules.narrowGate.bookAbbrToId);
const prayerScriptureWeights = collectPrayerScriptureVerseWeights();
const prayerScriptureKeys = new Set(prayerScriptureWeights.keys());
const comprehensiveKeys = new Set(EXPLORE_HOME_VERSE_POOL_VERSE_KEYS);
/** 与 Web `lib/scripture/explore-curated-pool-scope-id.ts` 一致 */
import {
  DEFAULT_HOME_VERSE_POOL_MENU_SCOPE,
  resolveHomeVersePoolMenuLabel,
} from "@/lib/home-prayer-pools/home-verse-pool-menu-scopes";
import { EXPLORE_CURATED_700_EXTRA_VERSE_KEY } from "@/lib/scripture/explore-curated-pool-scope-id";
import { YEARS_DAYS_ETERNITY_ZH } from "@/lib/explore/years-days-eternity-content";
const allKeys = unionSets(
  comprehensiveKeys,
  praiseWorshipKeys,
  wordOfGodKeys,
  yearsDaysEternityKeys,
  narrowGateKeys,
  prayerScriptureKeys,
);
allKeys.add(EXPLORE_CURATED_700_EXTRA_VERSE_KEY);

const allScopePriorityOrder: HomeVersePoolScopeId[] = [
  "comprehensive",
  "praise_worship",
  "word_of_god",
  "years_days_eternity",
  "narrow_gate",
  "prayer_scripture",
];

const allPriorityLookup = new Map<string, number>();
allScopePriorityOrder.forEach((scopeId, idx) => {
  const keys = scopeId === "comprehensive"
      ? comprehensiveKeys
      : scopeId === "praise_worship"
        ? praiseWorshipKeys
        : scopeId === "word_of_god"
          ? wordOfGodKeys
          : scopeId === "years_days_eternity"
            ? yearsDaysEternityKeys
            : scopeId === "narrow_gate"
              ? narrowGateKeys
              : prayerScriptureKeys;
  for (const key of keys) {
    if (!allPriorityLookup.has(key)) allPriorityLookup.set(key, idx);
  }
});

const prayerPriorityLookup = new Map<string, number>();
Array.from(prayerScriptureWeights.entries())
  .sort((a, b) => (a[1] !== b[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
  .forEach(([key], idx) => {
    prayerPriorityLookup.set(key, idx);
  });

export function homeVersePoolAllPriority(verseKey: string): number {
  return allPriorityLookup.get(verseKey) ?? 9999;
}

export function homeVersePoolPrayerPriority(verseKey: string): number {
  return prayerPriorityLookup.get(verseKey) ?? 9999;
}

export const HOME_VERSE_POOL_SCOPE_KEYS: Record<HomeVersePoolScopeId, Set<string>> = {
  comprehensive: comprehensiveKeys,
  praise_worship: praiseWorshipKeys,
  word_of_god: wordOfGodKeys,
  years_days_eternity: yearsDaysEternityKeys,
  narrow_gate: narrowGateKeys,
  prayer_scripture: prayerScriptureKeys,
  all: allKeys,
};

export function getHomeVersePoolScopeVerseCount(scopeId: HomeVersePoolScopeId): number {
  return HOME_VERSE_POOL_SCOPE_KEYS[scopeId].size;
}

export function appendHomeVersePoolScopeCount(
  label: string,
  count: number,
  locale: AppLocale,
): string {
  return locale === "en" ? `${label} (${count})` : `${label}（${count}）`;
}

export function resolveHomeVersePoolScopeLabelWithCount(
  scope: HomeVersePoolScopeOption,
  locale: AppLocale,
): string {
  return appendHomeVersePoolScopeCount(
    resolveHomeVersePoolScopeLabel(scope, locale),
    getHomeVersePoolScopeVerseCount(scope.id),
    locale,
  );
}

/** 用户菜单「主页经文池」：默认池展示文案。 */
export function resolveDefaultHomeVersePoolMenuLabel(locale: AppLocale): string {
  return resolveHomeVersePoolMenuLabel(DEFAULT_HOME_VERSE_POOL_MENU_SCOPE, locale);
}
