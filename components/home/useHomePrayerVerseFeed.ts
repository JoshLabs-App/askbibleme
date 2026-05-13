"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { HOME_PRAYER_FEED_BATCH_SIZE, HOME_PRAYER_PREFETCH_REMAINING } from "@/lib/home-prayer-pools/constants";
import {
  buildEntriesByLocaleFromKeys,
  ensureVerseBodiesLoaded,
  fetchHomePrayerManifest,
  prefetchChunkIdle,
  verseKeyToChunkIndex,
  type VerseBodyMap,
} from "@/lib/home-prayer-pools/loader";
import {
  advanceMemoryAfterShown,
  buildInitialVerseKeySequence,
  pickNextVerseKey,
} from "@/lib/home-prayer-pools/pick-next";
import {
  DEFAULT_HOME_PRAYER_PREFS,
  HOME_PRAYER_VERSE_FEED_RELOAD_EVENT,
  memoryNamespaceFromScope,
  readHomePrayerVersePrefs,
  scopeIdFromPrefs,
  verseTranslationIdsFromPrefs,
  writeHomePrayerVersePrefs,
} from "@/lib/home-prayer-pools/prefs";
import type { HomePrayerChunkV1, HomePrayerManifestV1 } from "@/lib/home-prayer-pools/types";

type Args = {
  fallbackByLocale: Record<AppLocale, HomeVerseEntry[]>;
};

export function useHomePrayerVerseFeed({ fallbackByLocale }: Args): {
  entriesByLocale: Record<AppLocale, HomeVerseEntry[]>;
  bilingual: boolean;
  verseKeys: string[] | undefined;
  onVerseCommitted: (key: string) => void;
  onNearEnd: (index: number, total: number) => void;
} {
  const [poolEntries, setPoolEntries] = useState<Record<AppLocale, HomeVerseEntry[]> | null>(null);
  const [verseKeys, setVerseKeys] = useState<string[]>([]);
  const [prefsToken, setPrefsToken] = useState(0);
  /** 首帧与 SSR 一致：勿在 hydration 前读 localStorage，否则双语等与服务器默认不符会触发 hydration mismatch */
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  const manifestRef = useRef<HomePrayerManifestV1 | null>(null);
  const bodiesRef = useRef<VerseBodyMap>(new Map());
  const chunkCacheRef = useRef(new Map<number, HomePrayerChunkV1>());
  const scopeIdRef = useRef("all");
  const keysQueueRef = useRef<string[]>([]);
  const extendingRef = useRef(false);
  const extendCooldownUntilRef = useRef(0);

  useEffect(() => {
    const onReload = () => setPrefsToken((x) => x + 1);
    window.addEventListener(HOME_PRAYER_VERSE_FEED_RELOAD_EVENT, onReload);
    return () => window.removeEventListener(HOME_PRAYER_VERSE_FEED_RELOAD_EVENT, onReload);
  }, []);

  useEffect(() => {
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const prefs = readHomePrayerVersePrefs();
      if (cancelled) return;
      const scopeId = scopeIdFromPrefs(prefs.verseScope);
      scopeIdRef.current = scopeId;
      const manifest = await fetchHomePrayerManifest(scopeId);
      if (cancelled) return;
      if (!manifest || manifest.entries.length === 0) {
        manifestRef.current = null;
        setPoolEntries(null);
        setVerseKeys([]);
        keysQueueRef.current = [];
        return;
      }
      manifestRef.current = manifest;
      const ns = memoryNamespaceFromScope(prefs.verseScope);
      const memory = { ...(prefs.memoryByNamespace[ns] ?? {}) };
      const keys = buildInitialVerseKeySequence(manifest, memory, HOME_PRAYER_FEED_BATCH_SIZE, Date.now(), Math.random);
      bodiesRef.current = new Map();
      chunkCacheRef.current = new Map();
      await ensureVerseBodiesLoaded(scopeId, manifest, keys, bodiesRef.current, chunkCacheRef.current);
      if (cancelled) return;
      const { zh, en } = verseTranslationIdsFromPrefs(prefs);
      const built = buildEntriesByLocaleFromKeys(keys, bodiesRef.current, zh, en);
      if (!built) {
        setPoolEntries(null);
        setVerseKeys([]);
        keysQueueRef.current = [];
        return;
      }
      keysQueueRef.current = [...keys];
      setVerseKeys(keys);
      setPoolEntries(built);
      const lastKey = keys[keys.length - 1];
      const ci = lastKey ? verseKeyToChunkIndex(manifest, lastKey) : null;
      if (ci != null) prefetchChunkIdle(scopeId, ci + 1, chunkCacheRef.current);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [prefsToken]);

  const onVerseCommitted = useCallback((key: string) => {
    const prefs = readHomePrayerVersePrefs();
    const ns = memoryNamespaceFromScope(prefs.verseScope);
    const mem = { ...(prefs.memoryByNamespace[ns] ?? {}) };
    advanceMemoryAfterShown(mem, key, Date.now());
    writeHomePrayerVersePrefs({
      ...prefs,
      memoryByNamespace: { ...prefs.memoryByNamespace, [ns]: mem },
    });
  }, []);

  const extendFeed = useCallback(async () => {
    if (extendingRef.current) return;
    const manifest = manifestRef.current;
    const scopeId = scopeIdRef.current;
    if (!manifest || manifest.entries.length === 0) return;
    extendingRef.current = true;
    try {
      const prefs = readHomePrayerVersePrefs();
      const ns = memoryNamespaceFromScope(prefs.verseScope);
      const memory = { ...(prefs.memoryByNamespace[ns] ?? {}) };
      const cur = keysQueueRef.current;
      const exclude = new Set(cur);
      const now = Date.now();
      const rng = Math.random;
      const tempMem = { ...memory };
      const more: string[] = [];
      const targetMore = Math.max(8, Math.floor(HOME_PRAYER_FEED_BATCH_SIZE / 2));
      for (let i = 0; i < targetMore; i++) {
        let k = pickNextVerseKey(manifest, tempMem, now, rng);
        let guard = 0;
        while (exclude.has(k) && guard < manifest.entries.length) {
          advanceMemoryAfterShown(tempMem, k, now);
          k = pickNextVerseKey(manifest, tempMem, now, rng);
          guard++;
        }
        if (!k || exclude.has(k)) break;
        exclude.add(k);
        more.push(k);
        advanceMemoryAfterShown(tempMem, k, now);
      }
      if (more.length === 0) return;
      const merged = [...cur, ...more];
      await ensureVerseBodiesLoaded(scopeId, manifest, merged, bodiesRef.current, chunkCacheRef.current);
      const { zh, en } = verseTranslationIdsFromPrefs(prefs);
      const built = buildEntriesByLocaleFromKeys(merged, bodiesRef.current, zh, en);
      if (!built) return;
      keysQueueRef.current = merged;
      setVerseKeys(merged);
      setPoolEntries(built);
      const lastKey = more[more.length - 1];
      const ci = lastKey ? verseKeyToChunkIndex(manifest, lastKey) : null;
      if (ci != null) prefetchChunkIdle(scopeId, ci + 1, chunkCacheRef.current);
    } finally {
      extendingRef.current = false;
    }
  }, []);

  const onNearEnd = useCallback(
    (index: number, total: number) => {
      if (total <= 0) return;
      if (index < total - HOME_PRAYER_PREFETCH_REMAINING) return;
      const now = Date.now();
      if (now < extendCooldownUntilRef.current) return;
      extendCooldownUntilRef.current = now + 8000;
      void extendFeed();
    },
    [extendFeed],
  );

  const merged = useMemo(() => {
    void prefsToken;
    const prefs = prefsHydrated ? readHomePrayerVersePrefs() : DEFAULT_HOME_PRAYER_PREFS;
    const bilingual = prefs.verseDisplay === "bilingual";
    if (poolEntries && verseKeys.length > 0) {
      return {
        entries: poolEntries,
        keys: verseKeys as string[],
        bilingual,
      };
    }
    return {
      entries: fallbackByLocale,
      keys: undefined as string[] | undefined,
      bilingual,
    };
  }, [poolEntries, verseKeys, fallbackByLocale, prefsToken, prefsHydrated]); // prefsHydrated：hydration 后再用本机偏好

  return {
    entriesByLocale: merged.entries,
    bilingual: merged.bilingual,
    verseKeys: merged.keys,
    onVerseCommitted,
    onNearEnd,
  };
}
