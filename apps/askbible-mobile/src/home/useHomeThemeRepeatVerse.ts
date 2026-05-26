import { useCallback, useEffect, useRef, useState } from "react";
import type { AppLocale } from "../i18n/config";
import type { HomeVersePoolScopeId } from "../explore/explore-home-verse-pool-scopes";
import { readHomePrayerVersePrefs, verseTranslationIdsFromPrefs } from "./homePrayerVersePrefs";
import { loadHomeVerseManifest, resolveHomeVersePair } from "./verse-pool/loader";
import { readHomeVerseMemory, writeHomeVerseMemory } from "./verse-pool/memory-prefs";
import { advanceMemoryAfterShown, pickNextVerseKey } from "./verse-pool/pick-next";
import type { HomePrayerManifestV1, HomeVerseEntry, PrayerMemoryRowV1 } from "./verse-pool/types";

const FALLBACK_ZH: HomeVerseEntry = {
  lines: ["你们要将一切的忧虑卸给神，因为他顾念你们。"],
  ref: "彼得前书 5:7",
};

const FALLBACK_EN: HomeVerseEntry = {
  lines: ["Cast all your worries on him, because he cares for you."],
  ref: "1 Peter 5:7",
};

export const HOME_VERSE_ROTATE_MS = 14_000;

async function pickShow(
  manifest: HomePrayerManifestV1,
  memory: Record<string, PrayerMemoryRowV1>,
  locale: AppLocale,
  primaryTranslationId: string,
  contrastTranslationId: string,
): Promise<{ primary: HomeVerseEntry; contrast: HomeVerseEntry | null; verseKey: string } | null> {
  const now = Date.now();
  const maxAttempts = Math.min(12, manifest.entries.length);
  const excluded = new Set<string>();

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
    advanceMemoryAfterShown(memory, key, now);
    const pair = await resolveHomeVersePair(
      manifest,
      key,
      locale,
      primaryTranslationId,
      contrastTranslationId,
    );
    if (pair) {
      await writeHomeVerseMemory(memory);
      return { ...pair, verseKey: key };
    }
  }

  await writeHomeVerseMemory(memory);
  return null;
}

/**
 * 首页经文：theme-repeat-ge5（约 4k+ 句），按主题库重复热度加权轮播（与网站壳层同源逻辑）。
 */
export function useHomeThemeRepeatVerse(
  locale: AppLocale,
  rotateMs = HOME_VERSE_ROTATE_MS,
  prefsVersion = 0,
  pauseRotation = false,
  poolScopeId?: HomeVersePoolScopeId,
) {
  const [ready, setReady] = useState(false);
  const [entry, setEntry] = useState<HomeVerseEntry | null>(null);
  const [contrastEntry, setContrastEntry] = useState<HomeVerseEntry | null>(null);
  const [verseKey, setVerseKey] = useState<string | null>(null);
  const memoryRef = useRef<Record<string, PrayerMemoryRowV1>>({});
  const manifestRef = useRef<HomePrayerManifestV1 | null>(null);
  const translationRef = useRef({ primary: "cuv-simp", contrast: "" });
  const [translationIds, setTranslationIds] = useState({
    primary: "cuv-simp",
    contrast: "",
  });

  const refreshTranslations = useCallback(async () => {
    const prefs = await readHomePrayerVersePrefs();
    const ids = verseTranslationIdsFromPrefs(prefs, locale);
    translationRef.current = ids;
    setTranslationIds(ids);
  }, [locale]);

  const advance = useCallback(async () => {
    const manifest = manifestRef.current;
    if (!manifest?.entries.length) return;
    const next = await pickShow(
      manifest,
      memoryRef.current,
      locale,
      translationRef.current.primary,
      translationRef.current.contrast,
    );
    if (next) {
      setEntry(next.primary);
      setContrastEntry(next.contrast);
      setVerseKey(next.verseKey);
    }
  }, [locale]);

  const reloadCurrentVerse = useCallback(async () => {
    const manifest = manifestRef.current;
    const key = verseKey;
    if (!manifest || !key) return;
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
    }
  }, [locale, verseKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refreshTranslations();
      const manifest = await loadHomeVerseManifest();
      if (cancelled) return;
      manifestRef.current = manifest;
      memoryRef.current = await readHomeVerseMemory();
      if (!manifest?.entries.length) {
        setEntry(locale === "en" ? FALLBACK_EN : FALLBACK_ZH);
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
        if (first) {
          setEntry(first.primary);
          setContrastEntry(first.contrast);
          setVerseKey(first.verseKey);
        } else {
          setEntry(locale === "en" ? FALLBACK_EN : FALLBACK_ZH);
          setContrastEntry(null);
          setVerseKey(null);
        }
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, refreshTranslations, poolScopeId]);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      await refreshTranslations();
      await reloadCurrentVerse();
    })();
  }, [prefsVersion, ready, refreshTranslations, reloadCurrentVerse]);

  useEffect(() => {
    if (!ready || !manifestRef.current?.entries.length || pauseRotation) return;
    const id = setInterval(() => {
      void advance();
    }, rotateMs);
    return () => clearInterval(id);
  }, [ready, advance, rotateMs, pauseRotation]);

  return {
    ready,
    entry,
    contrastEntry,
    verseKey,
    primaryTranslationId: translationIds.primary,
    contrastTranslationId: translationIds.contrast,
    poolSize: manifestRef.current?.entries.length ?? 0,
    advanceNow: advance,
  };
}
