import type { AppLocale } from "../../i18n/config";
import { getAskBibleBaseUrl } from "../../config/askbibleBaseUrl";
import { isMobileBundledOnly, isMobileOfflineFirst } from "../../config/mobileBundledOnly";
import { isNetworkAvailable } from "../../network/isNetworkAvailable";
import { flowLocaleForHomeVerseTranslationId } from "../homePrayerVersePrefs";
import { loadChapterFromBundledTranslation } from "../../bible/load-chapter";
import { parseVerseKey } from "../../bible/parse-verse-key";
import { resolveSameAsPreviousVerseText } from "../../bible/resolve-same-as-previous-verse";
import { getScriptureBookDisplayName } from "../../bible/scripture-book-display-name";
import {
  HOME_VERSE_POOL_SCOPE_KEYS,
  homeVersePoolAllPriority,
  homeVersePoolPrayerPriority,
  type HomeVersePoolScopeId,
} from "../../explore/explore-home-verse-pool-scopes";
import { hydrateHomeVersePoolScope } from "../homeVersePoolScopePrefs";
import { HOME_VERSE_POOL_SCOPE_ID } from "./chunk-registry.generated";
import type { HomePrayerManifestV1, HomeVerseEntry } from "./types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bundledManifest = (() => {
  try {
    return require("../../../assets/content/home-prayer-pools/theme-repeat-ge5/manifest.json") as HomePrayerManifestV1;
  } catch {
    return null;
  }
})();

const chapterCache = new Map<string, Promise<Awaited<ReturnType<typeof loadChapterFromBundledTranslation>>>>();

export function getBundledHomeVerseManifest(): HomePrayerManifestV1 | null {
  if (!bundledManifest || bundledManifest.version !== 1) return null;
  return bundledManifest;
}

async function fetchManifestFromNetwork(): Promise<HomePrayerManifestV1 | null> {
  if (isMobileOfflineFirst() || !(await isNetworkAvailable())) return null;
  try {
    const base = getAskBibleBaseUrl();
    const res = await fetch(`${base}/data/home-prayer-pools/${HOME_VERSE_POOL_SCOPE_ID}/manifest.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as HomePrayerManifestV1;
    return data?.version === 1 ? data : null;
  } catch {
    return null;
  }
}

function filterManifestToScope(
  manifest: HomePrayerManifestV1,
  scopeVerseKeys: Set<string>,
  scopeId: HomeVersePoolScopeId,
): HomePrayerManifestV1 {
  if (!manifest.entries.length) return manifest;
  const filteredEntriesRaw = manifest.entries.filter((e) => scopeVerseKeys.has(e.verseKey));
  const filteredEntries =
    scopeId === "all"
      ? filteredEntriesRaw
          .map((entry, idx) => ({ entry, idx, p: homeVersePoolAllPriority(entry.verseKey) }))
          .sort((a, b) => (a.p !== b.p ? a.p - b.p : a.idx - b.idx))
          .map((row) => row.entry)
      : scopeId === "prayer_scripture"
        ? filteredEntriesRaw
            .map((entry, idx) => ({ entry, idx, p: homeVersePoolPrayerPriority(entry.verseKey) }))
            .sort((a, b) => (a.p !== b.p ? a.p - b.p : a.idx - b.idx))
            .map((row) => row.entry)
      : filteredEntriesRaw;
  if (filteredEntries.length === 0) return manifest;
  const bootstrapVerseKeys = manifest.bootstrapVerseKeys ?? [];
  const nextBootstrapRaw = bootstrapVerseKeys.filter((k) => scopeVerseKeys.has(k));
  const nextBootstrap =
    scopeId === "all"
      ? [...nextBootstrapRaw].sort((a, b) => homeVersePoolAllPriority(a) - homeVersePoolAllPriority(b))
      : scopeId === "prayer_scripture"
        ? [...nextBootstrapRaw].sort((a, b) => homeVersePoolPrayerPriority(a) - homeVersePoolPrayerPriority(b))
      : nextBootstrapRaw;
  return {
    ...manifest,
    entries: filteredEntries,
    bootstrapVerseKeys: nextBootstrap.length ? nextBootstrap : filteredEntries.slice(0, 40).map((e) => e.verseKey),
  };
}

export async function loadHomeVerseManifest(): Promise<HomePrayerManifestV1 | null> {
  const selectedScopeId = await hydrateHomeVersePoolScope();
  const selectedScopeVerseKeys = HOME_VERSE_POOL_SCOPE_KEYS[selectedScopeId];
  const bundled = getBundledHomeVerseManifest();
  if (isMobileBundledOnly() || isMobileOfflineFirst()) {
    return bundled ? filterManifestToScope(bundled, selectedScopeVerseKeys, selectedScopeId) : bundled;
  }
  const merged = bundled ?? (await fetchManifestFromNetwork());
  return merged ? filterManifestToScope(merged, selectedScopeVerseKeys, selectedScopeId) : merged;
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
  if (locale === "en") return "kjv";
  if (locale === "zh-TW") return "cuv-trad";
  return "cuv-simp";
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
  const verseText = resolveSameAsPreviousVerseText(parsed.verse, rawText, verseTextByVerse).trim();
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

export async function resolveHomeVersePair(
  _manifest: HomePrayerManifestV1,
  verseKey: string,
  locale: AppLocale,
  primaryTranslationId: string,
  contrastTranslationId: string,
): Promise<ResolvedHomeVersePair | null> {
  const explicitPrimaryTid = primaryTranslationId.trim();
  const primaryTid = explicitPrimaryTid || defaultPrimaryTranslationId(locale);
  const contrastTid = contrastTranslationId.trim();

  const primary = await resolveVerseEntryByTranslation(verseKey, primaryTid);
  if (!primary?.lines?.length) return null;
  if (isLikelyIncompleteCjkSingleLine(primary)) return null;

  if (!contrastTid || contrastTid === primaryTid) {
    return { primary, contrast: null };
  }
  const contrast = await resolveVerseEntryByTranslation(verseKey, contrastTid);
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
