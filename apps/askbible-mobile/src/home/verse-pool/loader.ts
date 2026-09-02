import type { AppLocale } from "../../i18n/config";
import { getAskBibleBaseUrl } from "../../config/askbibleBaseUrl";
import { isMobileBundledOnly, isMobileOfflineFirst } from "../../config/mobileBundledOnly";
import { isNetworkAvailable } from "../../network/isNetworkAvailable";
import { flowLocaleForHomeVerseTranslationId } from "../homePrayerVersePrefs";
import { loadChapterFromBundledTranslation } from "../../bible/load-chapter";
import { parseVerseKey } from "@/lib/bible/parse-verse-key";
import { resolveSameAsPreviousVerseText } from "@/lib/bible/resolve-same-as-previous-verse";
import { getScriptureBookDisplayName } from "../../bible/scripture-book-display-name";
import { hydrateHomeVersePoolScope } from "../homeVersePoolScopePrefs";
import { getHomeVersePoolChunk, HOME_VERSE_POOL_SCOPE_ID } from "./chunk-registry.generated";
import type { HomePrayerChunkV1, HomePrayerChunkVerseV1, HomePrayerManifestV1, HomeVerseEntry } from "./types";
import { normalizeVerseTextForHomeDisplay } from "@/lib/bible/normalize-verse-text-for-home-display";
import {
  filterManifestToMenuScope,
} from "@/lib/home-prayer-pools/filter-manifest-to-menu-scope";
import {
  staticPoolScopeIdForMenuScope,
  THEME_REPEAT_GE5_POOL_SCOPE_ID,
} from "@/lib/home-prayer-pools/home-verse-pool-menu-scopes";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bundledGe5Manifest = (() => {
  try {
    return require("../../../assets/content/home-prayer-pools/theme-repeat-ge5/manifest.json") as HomePrayerManifestV1;
  } catch {
    return null;
  }
})();

const chapterCache = new Map<string, Promise<Awaited<ReturnType<typeof loadChapterFromBundledTranslation>>>>();
const remoteChunkCache = new Map<string, HomePrayerChunkV1>();
const verseBodyCache = new Map<string, HomePrayerChunkVerseV1>();

function getBundledManifestForScope(staticScopeId: string): HomePrayerManifestV1 | null {
  if (staticScopeId === THEME_REPEAT_GE5_POOL_SCOPE_ID || staticScopeId === HOME_VERSE_POOL_SCOPE_ID) {
    if (bundledGe5Manifest?.version === 1) return bundledGe5Manifest;
  }
  return null;
}

async function fetchManifestFromNetwork(staticScopeId: string): Promise<HomePrayerManifestV1 | null> {
  if (isMobileBundledOnly() || isMobileOfflineFirst() || !(await isNetworkAvailable())) return null;
  try {
    const base = getAskBibleBaseUrl();
    const res = await fetch(`${base}/data/home-prayer-pools/${staticScopeId}/manifest.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as HomePrayerManifestV1;
    return data?.version === 1 ? data : null;
  } catch {
    return null;
  }
}

export async function loadHomeVerseManifest(): Promise<HomePrayerManifestV1 | null> {
  const menuScope = await hydrateHomeVersePoolScope();
  const staticScopeId = staticPoolScopeIdForMenuScope(menuScope);
  const bundled = getBundledManifestForScope(staticScopeId);
  let manifest = bundled;
  if (!manifest && !isMobileBundledOnly() && !isMobileOfflineFirst()) {
    manifest = await fetchManifestFromNetwork(staticScopeId);
  }
  if (!manifest && staticScopeId !== HOME_VERSE_POOL_SCOPE_ID) {
    manifest = getBundledManifestForScope(HOME_VERSE_POOL_SCOPE_ID);
  }
  if (!manifest) return null;
  // curated700 已废弃为独立池；若旧存档仍带到此，当全量用。
  if (menuScope === "curated700") return filterManifestToMenuScope(manifest, "repeatGe5All");
  return filterManifestToMenuScope(manifest, menuScope);
}

function normalizeHomeVerseEntry(entry: HomeVerseEntry): HomeVerseEntry {
  const lines = Array.isArray(entry?.lines) ? entry.lines : [];
  return {
    ref: normalizeVerseTextForHomeDisplay(entry.ref) || String(entry.ref ?? "").trim(),
    lines: lines
      .map((line) => normalizeVerseTextForHomeDisplay(line) || String(line ?? "").trim())
      .filter(Boolean),
  };
}

function verseKeyToChunkIndex(manifest: HomePrayerManifestV1, verseKey: string): number | null {
  const row = manifest.entries.find((entry) => entry.verseKey === verseKey);
  return row?.chunkIndex ?? null;
}

async function loadChunkForManifest(
  manifest: HomePrayerManifestV1,
  chunkIndex: number,
): Promise<HomePrayerChunkV1 | null> {
  const cacheKey = `${manifest.scopeId}:${chunkIndex}`;
  const cached = remoteChunkCache.get(cacheKey);
  if (cached) return cached;

  if (manifest.scopeId === HOME_VERSE_POOL_SCOPE_ID) {
    return getHomeVersePoolChunk(chunkIndex);
  }

  if (isMobileBundledOnly() || isMobileOfflineFirst() || !(await isNetworkAvailable())) return null;
  try {
    const base = getAskBibleBaseUrl();
    const res = await fetch(`${base}/data/home-prayer-pools/${manifest.scopeId}/chunk-${chunkIndex}.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as HomePrayerChunkV1;
    if (data?.version !== 1) return null;
    remoteChunkCache.set(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

async function loadVerseBody(
  manifest: HomePrayerManifestV1,
  verseKey: string,
): Promise<HomePrayerChunkVerseV1 | null> {
  const cacheKey = `${manifest.scopeId}:${verseKey}`;
  const cached = verseBodyCache.get(cacheKey);
  if (cached) return cached;

  const chunkIndex = verseKeyToChunkIndex(manifest, verseKey);
  if (chunkIndex == null) return null;
  const chunk = await loadChunkForManifest(manifest, chunkIndex);
  if (!chunk) return null;
  const row = chunk.verses.find((verse) => verse.verseKey === verseKey) ?? null;
  if (row) verseBodyCache.set(cacheKey, row);
  return row;
}

function localeForTranslationId(translationId: string, locale: AppLocale): AppLocale {
  const flow = flowLocaleForHomeVerseTranslationId(translationId);
  if (flow === "en") return "en";
  if (flow === "zh-TW") return "zh-TW";
  return locale === "en" ? "en" : locale === "zh-TW" ? "zh-TW" : "zh-CN";
}

function entryForTranslationId(
  row: HomePrayerChunkVerseV1,
  translationId: string,
  locale: AppLocale,
): HomeVerseEntry | null {
  const tid = translationId.trim();
  const byTid = tid ? row.byTranslationId?.[tid] : null;
  if (byTid?.lines?.length) return normalizeHomeVerseEntry(byTid);

  const locKey = localeForTranslationId(tid, locale);
  const localized = row.locales[locKey] ?? row.locales["zh-CN"] ?? row.locales.en;
  if (localized?.lines?.length) return normalizeHomeVerseEntry(localized);
  return null;
}

async function resolveVerseEntryFromManifest(
  manifest: HomePrayerManifestV1,
  verseKey: string,
  locale: AppLocale,
  translationId: string,
): Promise<HomeVerseEntry | null> {
  const body = await loadVerseBody(manifest, verseKey);
  if (!body) return null;
  const tid = translationId.trim() || defaultPrimaryTranslationId(locale);
  return entryForTranslationId(body, tid, locale);
}

async function loadChapterCached(bookId: string, chapter: number, translationId: string) {
  const key = `${translationId}:${bookId}:${chapter}`;
  const cached = chapterCache.get(key);
  if (cached) return cached;
  const task = loadChapterFromBundledTranslation(bookId, chapter, translationId);
  chapterCache.set(key, task);
  return task;
}

function defaultPrimaryTranslationId(locale: AppLocale): string {
  if (locale === "en") return "web-en";
  if (locale === "zh-TW") return "cuv-trad";
  return "cuv-simp";
}

/** SQLite 诗篇首节常带「（…交与伶长）」标题，首页展示需去掉。 */
function stripLeadingPoetrySuperscription(text: string): string {
  return text.replace(/^（[^）]{1,48}）\s*/u, "").trim();
}

async function resolveVerseEntryByTranslation(
  verseKey: string,
  translationId: string,
): Promise<HomeVerseEntry | null> {
  const parsed = parseVerseKey(verseKey);
  if (!parsed) return null;
  const tid = translationId.trim();
  if (!tid) return null;
  const chapter = await loadChapterCached(parsed.bookId, parsed.chapter, tid);
  if (!chapter) return null;
  const verseTextByVerse = new Map(chapter.verses.map((v) => [v.verse, v.text]));
  const rawText = verseTextByVerse.get(parsed.verse)?.trim();
  if (!rawText) return null;
  let verseText = resolveSameAsPreviousVerseText(parsed.verse, rawText, verseTextByVerse).trim();
  if (!verseText) return null;
  verseText = stripLeadingPoetrySuperscription(verseText);
  if (!verseText) return null;
  const flow = flowLocaleForHomeVerseTranslationId(tid);
  const refLocale: AppLocale = flow === "en" ? "en" : flow === "zh-TW" ? "zh-TW" : "zh-CN";
  const bookName = getScriptureBookDisplayName(parsed.bookId, refLocale);
  return {
    lines: [verseText],
    ref: `${bookName} ${parsed.chapter}:${parsed.verse}`,
  };
}

export type ResolvedHomeVersePair = {
  primary: HomeVerseEntry;
  contrast: HomeVerseEntry | null;
};

const CJK_CHAR_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const INCOMPLETE_CJK_END_RE = /[，；：、]\s*$/;

function stripTailQuotes(text: string): string {
  return text.replace(/[」』”"\)\]）】〕〉》]+$/g, "").trimEnd();
}

function isLikelyIncompleteCjkSingleLine(entry: HomeVerseEntry): boolean {
  if (!entry.lines?.length) return true;
  if (entry.lines.length > 1) return false;
  const line = stripTailQuotes(entry.lines[0] ?? "").trim();
  if (!line || !CJK_CHAR_RE.test(line)) return false;
  return INCOMPLETE_CJK_END_RE.test(line);
}

async function resolveVerseEntryForTranslation(
  manifest: HomePrayerManifestV1,
  verseKey: string,
  locale: AppLocale,
  translationId: string,
): Promise<HomeVerseEntry | null> {
  // 主译本优先：已安装/内置 SQLite 正文；池内预置文案仅作兜底（语言对齐主译本）。
  const fromSqlite = await resolveVerseEntryByTranslation(verseKey, translationId);
  if (fromSqlite?.lines?.length) return fromSqlite;
  return resolveVerseEntryFromManifest(manifest, verseKey, locale, translationId);
}

export async function resolveHomeVersePair(
  manifest: HomePrayerManifestV1,
  verseKey: string,
  locale: AppLocale,
  primaryTranslationId: string,
  contrastTranslationId: string,
): Promise<ResolvedHomeVersePair | null> {
  const explicitPrimaryTid = primaryTranslationId.trim();
  const primaryTid = explicitPrimaryTid || defaultPrimaryTranslationId(locale);
  const contrastTid = contrastTranslationId.trim();

  const primary = await resolveVerseEntryForTranslation(manifest, verseKey, locale, primaryTid);
  if (!primary?.lines?.length) return null;
  if (isLikelyIncompleteCjkSingleLine(primary)) return null;

  if (!contrastTid || contrastTid === primaryTid) {
    return { primary, contrast: null };
  }
  const contrast = await resolveVerseEntryForTranslation(manifest, verseKey, locale, contrastTid);
  if (!contrast?.lines?.length) return null;
  return { primary, contrast };
}

export async function resolveHomeVerseEntry(
  manifest: HomePrayerManifestV1,
  verseKey: string,
  locale: AppLocale,
  primaryTranslationId = "cuv-simp",
  contrastTranslationId = "",
): Promise<HomeVerseEntry | null> {
  const pair = await resolveHomeVersePair(
    manifest,
    verseKey,
    locale,
    primaryTranslationId,
    contrastTranslationId,
  );
  return pair?.primary ?? null;
}

export function getBundledHomeVerseManifest(): HomePrayerManifestV1 | null {
  return getBundledManifestForScope(HOME_VERSE_POOL_SCOPE_ID);
}
