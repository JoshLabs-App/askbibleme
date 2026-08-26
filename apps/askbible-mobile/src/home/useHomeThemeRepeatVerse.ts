import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { InteractionManager } from "react-native";
import type { AppLocale } from "../i18n/config";
import { fetchBibleTranslationsCatalog, translationMetaFromCatalog } from "../api/fetchBibleTranslationsCatalog";
import { ensureScriptureTranslationReadyWithFallback } from "../bible/scripture-translation-download";
import {
  readReadBibleTranslationPrefs,
  subscribeReadBibleTranslation,
} from "../read/read-bible-translation-prefs";
import type { HomeVersePoolScopeId } from "./homeVersePoolScopePrefs";
import {
  DEFAULT_HOME_VERSE_ROTATION_SEC,
  getHomeVerseRotationSec,
  hydrateHomeVerseRotationSec,
  subscribeHomeVerseRotationSec,
} from "./homeVerseRotationPrefs";
import { flowLocaleForHomeVerseTranslationId } from "./homePrayerVersePrefs";
import { loadHomeVerseManifest, resolveHomeVersePair } from "./verse-pool/loader";
import { readHomeVerseMemory, writeHomeVerseMemory } from "./verse-pool/memory-prefs";
import { advanceMemoryAfterShown, pickNextVerseKey } from "./verse-pool/pick-next";
import type { HomePrayerManifestV1, HomeVerseEntry, PrayerMemoryRowV1 } from "./verse-pool/types";
import { ANDROID_GOLDEN_VERSE_PREFETCH_COUNT } from "./goldenVerseAudioRemote";

const FALLBACK_ZH: HomeVerseEntry = {
  lines: ["你们要将一切的忧虑卸给神，因为他顾念你们。"],
  ref: "彼得前书 5:7",
};

const FALLBACK_EN: HomeVerseEntry = {
  lines: ["Cast all your worries on him, because he cares for you."],
  ref: "1 Peter 5:7",
};

export const HOME_VERSE_ROTATE_MS = DEFAULT_HOME_VERSE_ROTATION_SEC * 1000;

async function pickShow(
  manifest: HomePrayerManifestV1,
  memory: Record<string, PrayerMemoryRowV1>,
  locale: AppLocale,
  primaryTranslationId: string,
  contrastTranslationId: string,
  avoidVerseKey?: string | null,
): Promise<{ primary: HomeVerseEntry; contrast: HomeVerseEntry | null; verseKey: string } | null> {
  const now = Date.now();
  const maxAttempts = Math.min(12, manifest.entries.length);
  const excluded = new Set<string>();
  const avoidKey = (avoidVerseKey ?? "").trim();
  if (avoidKey) excluded.add(avoidKey);

  for (let i = 0; i < maxAttempts; i += 1) {
    const candidateManifest =
      excluded.size === 0
        ? manifest
        : {
            ...manifest,
            entries: manifest.entries.filter((e) => !excluded.has(e.verseKey)),
          };
    if (candidateManifest.entries.length === 0) break;
    const key = pickNextVerseKey(candidateManifest, memory, now, Math.random);
    if (!key) break;
    excluded.add(key);
    const pair = await resolveHomeVersePair(
      manifest,
      key,
      locale,
      primaryTranslationId,
      contrastTranslationId,
    );
    if (pair) {
      advanceMemoryAfterShown(memory, key, now);
      await writeHomeVerseMemory(memory);
      return { ...pair, verseKey: key };
    }
  }

  // 兜底：随机尝试未命中时，顺序扫一遍，确保已选择的译本/对照真正生效。
  for (const row of manifest.entries) {
    if (excluded.has(row.verseKey)) continue;
    const pair = await resolveHomeVersePair(
      manifest,
      row.verseKey,
      locale,
      primaryTranslationId,
      contrastTranslationId,
    );
    if (!pair) continue;
    advanceMemoryAfterShown(memory, row.verseKey, now);
    await writeHomeVerseMemory(memory);
    return { ...pair, verseKey: row.verseKey };
  }

  await writeHomeVerseMemory(memory);
  return null;
}

/**
 * 首页经文：默认全量 theme-repeat-ge5；菜单筛选项是同一池过滤。
 */
export function useHomeThemeRepeatVerse(
  locale: AppLocale,
  rotateMsOverride?: number,
  prefsVersion = 0,
  pauseRotation = false,
  poolScopeId?: HomeVersePoolScopeId,
  forceVerseKey?: string | null,
) {
  const rotationSec = useSyncExternalStore(
    subscribeHomeVerseRotationSec,
    getHomeVerseRotationSec,
    () => DEFAULT_HOME_VERSE_ROTATION_SEC,
  );
  const rotateMs = rotateMsOverride ?? rotationSec * 1000;
  const [ready, setReady] = useState(false);
  const [entry, setEntry] = useState<HomeVerseEntry | null>(null);
  const [contrastEntry, setContrastEntry] = useState<HomeVerseEntry | null>(null);
  const [verseKey, setVerseKey] = useState<string | null>(null);
  const memoryRef = useRef<Record<string, PrayerMemoryRowV1>>({});
  const manifestRef = useRef<HomePrayerManifestV1 | null>(null);
  const translationRef = useRef({ primary: "cuv-simp", contrast: "" });
  const verseKeyRef = useRef<string | null>(null);
  const prefsReloadSkipInitialRef = useRef(true);
  const advanceInFlightRef = useRef(false);
  /**
   * 金句后台预取：按序锁定下一句 / 再下一句 key。
   * 必须与原生 next/nextNext URI 队列同序，否则会先播残留 URI 再被 JS 纠到新 pin。
   */
  const pinnedNextVerseKeysRef = useRef<string[]>([]);
  const [translationIds, setTranslationIds] = useState({
    primary: "cuv-simp",
    contrast: "",
  });
  const [readTranslationPrefsVersion, setReadTranslationPrefsVersion] = useState(0);

  useEffect(() => {
    return subscribeReadBibleTranslation(() => {
      setReadTranslationPrefsVersion((v) => v + 1);
    });
  }, []);

  useEffect(() => {
    void hydrateHomeVerseRotationSec();
  }, []);

  const refreshTranslations = useCallback(async () => {
    const catalog = await fetchBibleTranslationsCatalog().catch(() => null);
    const index = catalog ?? { translations: [], defaultTranslationId: null };
    const prefs = await readReadBibleTranslationPrefs(index, locale);
    const primaryId = prefs.primaryTranslationId.trim() || "cuv-simp";
    const primaryMeta = catalog ? translationMetaFromCatalog(catalog, primaryId) : null;
    const primary = await ensureScriptureTranslationReadyWithFallback(
      primaryId,
      primaryMeta?.downloadUrl,
    );
    // 首页只显示主译本，跟随读经设置；不展示对照。
    const contrast = "";
    translationRef.current = { primary, contrast };
    setTranslationIds((prev) =>
      prev.primary === primary && prev.contrast === contrast ? prev : { primary, contrast },
    );
  }, [locale]);

  useEffect(() => {
    verseKeyRef.current = verseKey;
  }, [verseKey]);

  const pinNextVerseKey = useCallback((key: string | null) => {
    const trimmed = (key ?? "").trim().toUpperCase();
    if (!trimmed) {
      pinnedNextVerseKeysRef.current = [];
      return;
    }
    const rest = pinnedNextVerseKeysRef.current.filter((k) => k !== trimmed);
    pinnedNextVerseKeysRef.current = [trimmed, ...rest].slice(0, ANDROID_GOLDEN_VERSE_PREFETCH_COUNT);
  }, []);

  const pickUnpinnedVerseKey = useCallback((excluded: Set<string>): string | null => {
    const manifest = manifestRef.current;
    if (!manifest?.entries.length) return null;
    for (let i = 0; i < 8; i += 1) {
      const candidateManifest = {
        ...manifest,
        entries: manifest.entries.filter(
          (e) => !excluded.has((e.verseKey ?? "").trim().toUpperCase()),
        ),
      };
      if (!candidateManifest.entries.length) break;
      const key = pickNextVerseKey(candidateManifest, memoryRef.current, Date.now(), Math.random);
      if (!key || excluded.has(key.toUpperCase())) continue;
      return key;
    }
    return null;
  }, []);

  const peekNextVerseKey = useCallback((): string | null => {
    const pinned = (pinnedNextVerseKeysRef.current[0] ?? "").trim();
    if (pinned) return pinned;
    const excluded = new Set(
      [(verseKeyRef.current ?? "").trim()].filter(Boolean).map((k) => k.toUpperCase()),
    );
    const key = pickUnpinnedVerseKey(excluded);
    if (!key) return null;
    pinnedNextVerseKeysRef.current = [key];
    return key;
  }, [pickUnpinnedVerseKey]);

  /** 预取 N 句并按序 pin；已有更长队列时不截短。 */
  const peekNextVerseKeys = useCallback(
    (count: number): string[] => {
      const n = Math.max(0, Math.min(ANDROID_GOLDEN_VERSE_PREFETCH_COUNT, Math.floor(count)));
      const excluded = new Set(
        [(verseKeyRef.current ?? "").trim()].filter(Boolean).map((k) => k.toUpperCase()),
      );
      const keys: string[] = [];
      for (const pinned of pinnedNextVerseKeysRef.current) {
        const key = pinned.trim();
        if (!key) continue;
        const id = key.toUpperCase();
        if (excluded.has(id)) continue;
        keys.push(key);
        excluded.add(id);
      }
      while (keys.length < n) {
        const next = pickUnpinnedVerseKey(excluded);
        if (!next) break;
        keys.push(next);
        excluded.add(next.toUpperCase());
      }
      pinnedNextVerseKeysRef.current = keys;
      return keys.slice(0, n);
    },
    [pickUnpinnedVerseKey],
  );

  /** 预取两句：两句都按序 pin，与原生 next/nextNext 对齐。 */
  const peekNextTwoVerseKeys = useCallback(() => {
    const keys = peekNextVerseKeys(Math.max(2, pinnedNextVerseKeysRef.current.length));
    return [keys[0] ?? null, keys[1] ?? null] as [string | null, string | null];
  }, [peekNextVerseKeys]);

  const advance = useCallback(async () => {
    if (advanceInFlightRef.current) return;
    const manifest = manifestRef.current;
    if (!manifest?.entries.length) return;
    advanceInFlightRef.current = true;
    try {
      const pinned = (pinnedNextVerseKeysRef.current.shift() ?? "").trim();
      if (pinned) {
        const pair = await resolveHomeVersePair(
          manifest,
          pinned,
          locale,
          translationRef.current.primary,
          translationRef.current.contrast,
        );
        if (pair) {
          advanceMemoryAfterShown(memoryRef.current, pinned, Date.now());
          await writeHomeVerseMemory(memoryRef.current);
          setEntry(pair.primary);
          setContrastEntry(pair.contrast);
          setVerseKey(pinned);
          return;
        }
      }
      const next = await pickShow(
        manifest,
        memoryRef.current,
        locale,
        translationRef.current.primary,
        translationRef.current.contrast,
        verseKeyRef.current,
      );
      if (next) {
        setEntry(next.primary);
        setContrastEntry(next.contrast);
        setVerseKey(next.verseKey);
      }
    } finally {
      advanceInFlightRef.current = false;
    }
  }, [locale]);

  const reloadCurrentVerse = useCallback(async () => {
    const manifest = manifestRef.current;
    const key = verseKeyRef.current;
    if (!manifest) return;
    if (key) {
      const pair = await resolveHomeVersePair(
        manifest,
        key,
        locale,
        translationRef.current.primary,
        translationRef.current.contrast,
      );
      if (pair) {
        setEntry(pair.primary);
        setContrastEntry(pair.contrast);
        return;
      }
    }
    const next = await pickShow(
      manifest,
      memoryRef.current,
      locale,
      translationRef.current.primary,
      translationRef.current.contrast,
      key,
    );
    if (next) {
      setEntry(next.primary);
      setContrastEntry(next.contrast);
      setVerseKey(next.verseKey);
      return;
    }
    const flow = flowLocaleForHomeVerseTranslationId(translationRef.current.primary);
    setEntry(flow === "en" ? FALLBACK_EN : FALLBACK_ZH);
    setContrastEntry(null);
    setVerseKey(null);
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        await refreshTranslations();
        const manifest = await loadHomeVerseManifest();
        if (cancelled) return;
        manifestRef.current = manifest;
        memoryRef.current = await readHomeVerseMemory();
        if (!manifest?.entries.length) {
          const flow = flowLocaleForHomeVerseTranslationId(translationRef.current.primary);
          setEntry(flow === "en" ? FALLBACK_EN : FALLBACK_ZH);
          setContrastEntry(null);
          setVerseKey(null);
          setReady(true);
          return;
        }
        const first = await pickShow(
          manifest,
          memoryRef.current,
          locale,
          translationRef.current.primary,
          translationRef.current.contrast,
        );
        if (!cancelled) {
          const { primary, contrast } = translationRef.current;
          setTranslationIds({ primary, contrast });
          if (first) {
            setEntry(first.primary);
            setContrastEntry(first.contrast);
            setVerseKey(first.verseKey);
          } else {
            const flow = flowLocaleForHomeVerseTranslationId(translationRef.current.primary);
            setEntry(flow === "en" ? FALLBACK_EN : FALLBACK_ZH);
            setContrastEntry(null);
            setVerseKey(null);
          }
          setReady(true);
        }
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [locale, refreshTranslations, poolScopeId]);

  useEffect(() => {
    if (!ready) return;
    if (prefsReloadSkipInitialRef.current) {
      prefsReloadSkipInitialRef.current = false;
      return;
    }
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        await refreshTranslations();
        if (cancelled) return;
        await reloadCurrentVerse();
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [prefsVersion, readTranslationPrefsVersion, ready, refreshTranslations, reloadCurrentVerse]);

  useEffect(() => {
    if (!ready || !manifestRef.current?.entries.length || pauseRotation) return;
    const id = setInterval(() => {
      void advance();
    }, rotateMs);
    return () => clearInterval(id);
  }, [ready, advance, rotateMs, pauseRotation]);

  useEffect(() => {
    const key = (forceVerseKey || "").trim().toUpperCase();
    if (!ready || !key) return;
    const manifest = manifestRef.current;
    if (!manifest) return;
    let cancelled = false;
    void (async () => {
      const pair = await resolveHomeVersePair(
        manifest,
        key,
        locale,
        translationRef.current.primary,
        translationRef.current.contrast,
      );
      if (cancelled) return;
      if (pair) {
        setEntry(pair.primary);
        setContrastEntry(pair.contrast);
        setVerseKey(key);
        return;
      }
      // 池外经文：仍锁定 key，正文由音频侧负责；显示回落为当前译本直查。
      setVerseKey(key);
    })();
    return () => {
      cancelled = true;
    };
  }, [forceVerseKey, locale, ready]);

  return {
    ready,
    entry,
    contrastEntry,
    verseKey,
    primaryTranslationId: translationIds.primary,
    contrastTranslationId: translationIds.contrast,
    poolSize: manifestRef.current?.entries.length ?? 0,
    advanceNow: advance,
    peekNextVerseKey,
    peekNextTwoVerseKeys,
    peekNextVerseKeys,
    pinNextVerseKey,
  };
}
