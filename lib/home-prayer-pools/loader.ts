import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import type { HomePrayerChunkV1, HomePrayerManifestV1, HomePrayerChunkVerseV1 } from "@/lib/home-prayer-pools/types";
import { normalizeVerseTextForHomeDisplay } from "@/lib/bible/normalize-verse-text-for-home-display";
import { HOME_PRAYER_POOL_PUBLIC_BASE } from "@/lib/home-prayer-pools/constants";
import {
  HOME_PRAYER_POOL_CHUNKS,
  HOME_PRAYER_POOL_MANIFEST_GE5,
  HOME_PRAYER_POOL_SCOPE_ID,
} from "@/lib/home-prayer-pools/chunk-registry.generated";

function isManifestValid(data: HomePrayerManifestV1): boolean {
  return data?.version === 1 && Array.isArray(data.entries);
}

function isChunkValid(data: HomePrayerChunkV1): boolean {
  return data?.version === 1 && Array.isArray(data.verses);
}

export function manifestUrl(scopeId: string): string {
  return `${HOME_PRAYER_POOL_PUBLIC_BASE}/${encodeURIComponent(scopeId)}/manifest.json`;
}

export function chunkUrl(scopeId: string, chunkIndex: number): string {
  return `${HOME_PRAYER_POOL_PUBLIC_BASE}/${encodeURIComponent(scopeId)}/chunk-${chunkIndex}.json`;
}

export async function fetchHomePrayerManifest(scopeId: string): Promise<HomePrayerManifestV1 | null> {
  if (scopeId === HOME_PRAYER_POOL_SCOPE_ID) {
    return isManifestValid(HOME_PRAYER_POOL_MANIFEST_GE5) ? HOME_PRAYER_POOL_MANIFEST_GE5 : null;
  }
  try {
    const res = await fetch(manifestUrl(scopeId), { cache: "force-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as HomePrayerManifestV1;
    return isManifestValid(data) ? data : null;
  } catch {
    return null;
  }
}

export async function fetchHomePrayerChunk(scopeId: string, chunkIndex: number): Promise<HomePrayerChunkV1 | null> {
  if (scopeId === HOME_PRAYER_POOL_SCOPE_ID) {
    const data = HOME_PRAYER_POOL_CHUNKS[chunkIndex];
    return data && isChunkValid(data) ? data : null;
  }
  try {
    const res = await fetch(chunkUrl(scopeId, chunkIndex), { cache: "force-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as HomePrayerChunkV1;
    return isChunkValid(data) ? data : null;
  } catch {
    return null;
  }
}

export type VerseBodyRow = HomePrayerChunkVerseV1;

export type VerseBodyMap = Map<string, VerseBodyRow>;

export function verseKeyToChunkIndex(manifest: HomePrayerManifestV1, verseKey: string): number | null {
  const row = manifest.entries.find((e) => e.verseKey === verseKey);
  return row ? row.chunkIndex : null;
}

/**
 * 确保给定 `verseKeys` 的正文已加载到 `bodies`（按需 fetch chunk）。
 */
export async function ensureVerseBodiesLoaded(
  scopeId: string,
  manifest: HomePrayerManifestV1,
  verseKeys: string[],
  bodies: VerseBodyMap,
  chunkCache: Map<number, HomePrayerChunkV1>,
): Promise<void> {
  const neededChunks = new Set<number>();
  for (const key of verseKeys) {
    if (bodies.has(key)) continue;
    const ci = verseKeyToChunkIndex(manifest, key);
    if (ci != null) neededChunks.add(ci);
  }
  for (const ci of neededChunks) {
    if (chunkCache.has(ci)) {
      const ch = chunkCache.get(ci)!;
      for (const v of ch.verses) {
        bodies.set(v.verseKey, v);
      }
      continue;
    }
    const ch = await fetchHomePrayerChunk(scopeId, ci);
    if (!ch) continue;
    chunkCache.set(ci, ch);
    for (const v of ch.verses) {
      bodies.set(v.verseKey, v);
    }
  }
}

function normalizeHomeVerseEntry(e: HomeVerseEntry): HomeVerseEntry {
  return {
    ref: normalizeVerseTextForHomeDisplay(e.ref) || e.ref.trim(),
    lines: e.lines.map((ln) => normalizeVerseTextForHomeDisplay(ln) || ln.trim()),
  };
}

function entryForTranslationId(row: VerseBodyRow, tid: string): HomeVerseEntry | null {
  const hit = row.byTranslationId?.[tid];
  return hit?.lines?.length ? hit : null;
}

export function buildEntriesByLocaleFromKeys(
  verseKeys: string[],
  bodies: VerseBodyMap,
  zhTranslationId: string,
  enTranslationId: string,
  zhTwTranslationId = "cuv-trad",
): Record<AppLocale, HomeVerseEntry[]> | null {
  const zhTid = zhTranslationId.trim() || "cuv-simp";
  const enTid = enTranslationId.trim() || "web-en";
  const zhTwTid = zhTwTranslationId.trim() || "cuv-trad";
  const zh: HomeVerseEntry[] = [];
  const zhTw: HomeVerseEntry[] = [];
  const en: HomeVerseEntry[] = [];
  for (const key of verseKeys) {
    const row = bodies.get(key);
    if (!row) return null;
    let a = entryForTranslationId(row, zhTid) ?? row.locales["zh-CN"];
    let tw = entryForTranslationId(row, zhTwTid) ?? a;
    let b = entryForTranslationId(row, enTid) ?? row.locales.en;
    if (!a?.lines?.length && !b?.lines?.length) return null;
    const zhEntry = a?.lines?.length ? a : b!;
    const zhTwEntry = tw?.lines?.length ? tw : zhEntry;
    const enEntry = b?.lines?.length ? b : a!;
    zh.push(normalizeHomeVerseEntry(zhEntry));
    zhTw.push(normalizeHomeVerseEntry(zhTwEntry));
    en.push(normalizeHomeVerseEntry(enEntry));
  }
  return { "zh-CN": zh, "zh-TW": zhTw, en };
}

export function prefetchChunkIdle(scopeId: string, chunkIndex: number, chunkCache: Map<number, HomePrayerChunkV1>): void {
  if (chunkCache.has(chunkIndex)) return;
  if (scopeId === HOME_PRAYER_POOL_SCOPE_ID) {
    const ch = HOME_PRAYER_POOL_CHUNKS[chunkIndex];
    if (ch && isChunkValid(ch)) chunkCache.set(chunkIndex, ch);
    return;
  }
  if (typeof window === "undefined") return;
  const run = () => {
    void fetchHomePrayerChunk(scopeId, chunkIndex).then((ch) => {
      if (ch) chunkCache.set(chunkIndex, ch);
    });
  };
  if ("requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback(
      run,
      { timeout: 4000 },
    );
  } else {
    setTimeout(run, 80);
  }
}
