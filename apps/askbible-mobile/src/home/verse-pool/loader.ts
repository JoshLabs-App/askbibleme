import type { AppLocale } from "../../i18n/config";
import { getAskBibleBaseUrl } from "../../config/askbibleBaseUrl";
import { isMobileBundledOnly } from "../../config/mobileBundledOnly";
import {
  HOME_VERSE_POOL_SCOPE_KEYS,
  homeVersePoolAllPriority,
  homeVersePoolPrayerPriority,
  type HomeVersePoolScopeId,
} from "../../explore/explore-home-verse-pool-scopes";
import { hydrateHomeVersePoolScope } from "../homeVersePoolScopePrefs";
import { HOME_VERSE_POOL_CHUNKS, HOME_VERSE_POOL_SCOPE_ID } from "./chunk-registry.generated";
import type {
  HomePrayerChunkV1,
  HomePrayerManifestV1,
  HomeVerseEntry,
  HomePrayerChunkVerseV1,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bundledManifest = (() => {
  try {
    return require("../../../assets/content/home-prayer-pools/theme-repeat-ge5/manifest.json") as HomePrayerManifestV1;
  } catch {
    return null;
  }
})();

const chunkCache = new Map<number, HomePrayerChunkV1>();
const bodyCache = new Map<string, HomePrayerChunkVerseV1>();

export function getBundledHomeVerseManifest(): HomePrayerManifestV1 | null {
  if (!bundledManifest || bundledManifest.version !== 1) return null;
  return bundledManifest;
}

async function fetchManifestFromNetwork(): Promise<HomePrayerManifestV1 | null> {
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
  const nextBootstrapRaw = manifest.bootstrapVerseKeys.filter((k) => scopeVerseKeys.has(k));
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
  if (isMobileBundledOnly()) {
    return bundled ? filterManifestToScope(bundled, selectedScopeVerseKeys, selectedScopeId) : bundled;
  }
  const merged = bundled ?? (await fetchManifestFromNetwork());
  return merged ? filterManifestToScope(merged, selectedScopeVerseKeys, selectedScopeId) : merged;
}

function verseKeyToChunkIndex(manifest: HomePrayerManifestV1, verseKey: string): number | null {
  const row = manifest.entries.find((e) => e.verseKey === verseKey);
  return row ? row.chunkIndex : null;
}

async function loadChunk(chunkIndex: number): Promise<HomePrayerChunkV1 | null> {
  if (chunkCache.has(chunkIndex)) return chunkCache.get(chunkIndex)!;

  const bundled = HOME_VERSE_POOL_CHUNKS[chunkIndex];
  if (bundled?.version === 1) {
    chunkCache.set(chunkIndex, bundled);
    return bundled;
  }

  if (isMobileBundledOnly()) return null;

  try {
    const base = getAskBibleBaseUrl();
    const res = await fetch(
      `${base}/data/home-prayer-pools/${HOME_VERSE_POOL_SCOPE_ID}/chunk-${chunkIndex}.json`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as HomePrayerChunkV1;
    if (data?.version !== 1) return null;
    chunkCache.set(chunkIndex, data);
    return data;
  } catch {
    return null;
  }
}

async function ensureVerseBody(verseKey: string, manifest: HomePrayerManifestV1): Promise<HomePrayerChunkVerseV1 | null> {
  const cached = bodyCache.get(verseKey);
  if (cached) return cached;

  const ci = verseKeyToChunkIndex(manifest, verseKey);
  if (ci == null) return null;
  const chunk = await loadChunk(ci);
  if (!chunk) return null;
  for (const v of chunk.verses) {
    bodyCache.set(v.verseKey, v);
  }
  return bodyCache.get(verseKey) ?? null;
}

function entryForTranslationId(row: HomePrayerChunkVerseV1, translationId: string): HomeVerseEntry | null {
  const tid = translationId.trim();
  if (!tid) return null;
  const byTid = row.byTranslationId?.[tid];
  if (byTid?.lines?.length) return byTid;
  return null;
}

function entryForLocale(row: HomePrayerChunkVerseV1, locale: AppLocale): HomeVerseEntry | null {
  const tid = locale === "zh-CN" ? "cuv-simp" : "web-en";
  return entryForTranslationId(row, tid) ?? (row.locales[locale]?.lines?.length ? row.locales[locale] : null);
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
  manifest: HomePrayerManifestV1,
  verseKey: string,
  locale: AppLocale,
  primaryTranslationId: string,
  contrastTranslationId: string,
): Promise<ResolvedHomeVersePair | null> {
  const row = await ensureVerseBody(verseKey, manifest);
  if (!row) return null;

  const primaryTid =
    primaryTranslationId.trim() || (locale === "zh-CN" ? "cuv-simp" : "web-en");
  const contrastTid = contrastTranslationId.trim();

  const primary =
    entryForTranslationId(row, primaryTid) ?? entryForLocale(row, locale);
  if (!primary?.lines?.length) return null;
  if (isLikelyIncompleteCjkSingleLine(primary)) return null;

  const contrastRaw =
    contrastTid && contrastTid !== primaryTid
      ? entryForTranslationId(row, contrastTid)
      : null;
  const contrast = contrastRaw?.lines?.length ? contrastRaw : null;
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
