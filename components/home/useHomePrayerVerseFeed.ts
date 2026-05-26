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
  persistVerseDisplayToCookie,
  readHomePrayerVersePrefs,
  scopeIdFromPrefs,
  verseTranslationIdsFromPrefs,
  writeHomePrayerVersePrefs,
} from "@/lib/home-prayer-pools/prefs";
import type { HomePrayerChunkV1, HomePrayerManifestV1 } from "@/lib/home-prayer-pools/types";
import { HOME_PRAYER_POOL_SCOPE_ID } from "@/lib/home-prayer-pools/chunk-registry.generated";
import { readVerifiedHomePrayerPoolConfig } from "@/lib/home-prayer-pools/remote-config";

/** 各语言列表应对齐；取最短长度用于整体环形平移，双语索引仍一致。 */
function alignedFallbackSpanLength(by: Record<AppLocale, HomeVerseEntry[]>): number {
  const lens = (Object.keys(by) as AppLocale[])
    .map((L) => (by[L] ?? []).length)
    .filter((n) => n > 0);
  if (lens.length === 0) return 0;
  return Math.min(...lens);
}

function rotateFallbackByLocale(
  by: Record<AppLocale, HomeVerseEntry[]>,
  offset: number,
): Record<AppLocale, HomeVerseEntry[]> {
  const n = alignedFallbackSpanLength(by);
  if (n <= 1) return by;
  const o = ((offset % n) + n) % n;
  if (o === 0) return by;
  const out: Record<AppLocale, HomeVerseEntry[]> = { ...by };
  for (const L of Object.keys(by) as AppLocale[]) {
    const arr = by[L] ?? [];
    if (arr.length < n) continue;
    out[L] = [...arr.slice(o), ...arr.slice(0, o)];
  }
  return out;
}

type Args = {
  fallbackByLocale: Record<AppLocale, HomeVerseEntry[]>;
};

function memoryNamespaceFromScopeId(scopeId: string): string {
  return scopeId.trim() || HOME_PRAYER_POOL_SCOPE_ID;
}

function pickScopeIdForFeed(
  localScopeId: string,
  remote: Awaited<ReturnType<typeof readVerifiedHomePrayerPoolConfig>>,
): string {
  if (!remote) return localScopeId;
  const allowlist = new Set(remote.allowlistedScopeIds);
  if (allowlist.has(localScopeId)) return localScopeId;
  if (allowlist.has(remote.selectedScopeId)) return remote.selectedScopeId;
  return HOME_PRAYER_POOL_SCOPE_ID;
}

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
  const scopeIdRef = useRef<string>(HOME_PRAYER_POOL_SCOPE_ID);
  const keysQueueRef = useRef<string[]>([]);
  const extendingRef = useRef(false);
  const extendCooldownUntilRef = useRef(0);
  /** 无祷告池 key 时使用硬编码/RSC 列表：随机起点，避免每次打开都是 rotation 第一条（诗篇 121）。 */
  const fallbackSpinRef = useRef<number | null>(null);
  const fallbackSpinPrefsTokenRef = useRef<number | null>(null);

  useEffect(() => {
    const onReload = () => setPrefsToken((x) => x + 1);
    window.addEventListener(HOME_PRAYER_VERSE_FEED_RELOAD_EVENT, onReload);
    return () => window.removeEventListener(HOME_PRAYER_VERSE_FEED_RELOAD_EVENT, onReload);
  }, []);

  useEffect(() => {
    setPrefsHydrated(true);
  }, []);

  /** 将本机「双语展示」偏好同步到 Cookie，便于后续 RSC 只解析需要的语言（单语不解析另一语言） */
  useEffect(() => {
    persistVerseDisplayToCookie(readHomePrayerVersePrefs().verseDisplay);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let idleHandle: number | undefined;
    let fallbackTimer: number | undefined;

    const run = async () => {
      const prefs = readHomePrayerVersePrefs();
      if (cancelled) return;
      const localScopeId = scopeIdFromPrefs(prefs.verseScope);
      const remoteConfig = await readVerifiedHomePrayerPoolConfig();
      if (cancelled) return;
      const scopeId = pickScopeIdForFeed(localScopeId, remoteConfig);
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
      const ns = memoryNamespaceFromScopeId(scopeId);
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

    const kick = () => {
      if (!cancelled) void run();
    };

    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(kick, { timeout: 5000 });
    } else {
      fallbackTimer = window.setTimeout(kick, 1200);
    }

    return () => {
      cancelled = true;
      if (idleHandle != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
    };
  }, [prefsToken]);

  const onVerseCommitted = useCallback((key: string) => {
    const prefs = readHomePrayerVersePrefs();
    const ns = memoryNamespaceFromScopeId(scopeIdRef.current);
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
      const ns = memoryNamespaceFromScopeId(scopeId);
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
      fallbackSpinRef.current = null;
      return {
        entries: poolEntries,
        keys: verseKeys as string[],
        bilingual,
      };
    }
    if (!prefsHydrated) {
      return {
        entries: fallbackByLocale,
        keys: undefined as string[] | undefined,
        bilingual,
      };
    }
    const n = alignedFallbackSpanLength(fallbackByLocale);
    if (fallbackSpinPrefsTokenRef.current !== prefsToken) {
      fallbackSpinPrefsTokenRef.current = prefsToken;
      fallbackSpinRef.current = null;
    }
    if (fallbackSpinRef.current === null && n > 1) {
      fallbackSpinRef.current = Math.floor(Math.random() * n);
    }
    const spin = fallbackSpinRef.current ?? 0;
    const entries = n <= 1 ? fallbackByLocale : rotateFallbackByLocale(fallbackByLocale, spin);
    return {
      entries,
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
