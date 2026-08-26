import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bundledBibleTranslationsCatalog,
  clearBibleTranslationsCatalogCache,
  fetchBibleTranslationsCatalogFresh,
} from "../api/fetchBibleTranslationsCatalog";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { preloadPrimaryScriptureTranslation } from "../bible/scripture-translation-download";
import { inferAppLocaleFromDevice } from "../i18n/config";
import { getLocale, hydrateLocaleFromStorage, subscribeLocale } from "../i18n/locale-store";
import type { BibleTranslationMeta, BibleTranslationsIndex } from "../bible/translations-types";
import {
  hasReadBibleTranslationPrefsStored,
  readReadBibleTranslationPrefMode,
  readReadBibleTranslationPrefs,
  resolveDefaultPrimaryTranslationId,
  writeReadBibleTranslationPrefMode,
  writeReadBibleTranslationPrefs,
  type ReadBibleTranslationPrefsV1,
} from "./read-bible-translation-prefs";
import { syncHomeVersePrefsFromPrimary } from "./readBibleTranslationHomeSync";

export function useReadBibleTranslationCatalogBootstrap() {
  const [translation, setTranslation] = useState<ReadBibleTranslationPrefsV1>(() => ({
    version: 1,
    primaryTranslationId: resolveDefaultPrimaryTranslationId(
      { translations: [], defaultTranslationId: null },
      inferAppLocaleFromDevice(),
    ),
    contrastTranslationIds: [],
    audioTranslationId: null,
  }));
  const [translationCatalog, setTranslationCatalog] = useState<BibleTranslationMeta[]>([]);
  const [defaultTranslationId, setDefaultTranslationId] = useState<string | null>("cuv-simp");
  const [translationCatalogReady, setTranslationCatalogReady] = useState(false);

  const translationIndex = useMemo(
    (): BibleTranslationsIndex => ({
      translations: translationCatalog,
      defaultTranslationId: defaultTranslationId ?? translationCatalog[0]?.id ?? "cuv-simp",
    }),
    [translationCatalog, defaultTranslationId],
  );

  const syncAutoTranslationForLocale = useCallback(async () => {
    if (!translationCatalogReady) return;
    const locale = getLocale();
    const mode = await readReadBibleTranslationPrefMode();
    if (mode !== "auto") return;
    const prefs = await readReadBibleTranslationPrefs(translationIndex, locale);
    const normalized = await writeReadBibleTranslationPrefs(prefs, translationIndex);
    await syncHomeVersePrefsFromPrimary(translationIndex, normalized.primaryTranslationId, { mode: "auto" });
    setTranslation(normalized);
  }, [translationCatalogReady, translationIndex]);

  useEffect(() => {
    let cancelled = false;
    const offlineIndex = bundledBibleTranslationsCatalog();

    setTranslationCatalog(offlineIndex.translations);
    setDefaultTranslationId(offlineIndex.defaultTranslationId);
    setTranslationCatalogReady(true);

    void (async () => {
      try {
        await hydrateLocaleFromStorage();
        if (cancelled) return;

        const locale = getLocale();
        const earlyPrimary = resolveDefaultPrimaryTranslationId(offlineIndex, locale);
        void preloadPrimaryScriptureTranslation(earlyPrimary);

        const applyCatalog = async (index: BibleTranslationsIndex) => {
          if (cancelled) return;
          setTranslationCatalog(index.translations);
          setDefaultTranslationId(index.defaultTranslationId);
          setTranslationCatalogReady(true);

          const hasStoredPrefs = await hasReadBibleTranslationPrefsStored();
          let normalized: ReadBibleTranslationPrefsV1;
          if (!hasStoredPrefs) {
            const localeDefaultPrimary = resolveDefaultPrimaryTranslationId(index, locale);
            normalized = await writeReadBibleTranslationPrefs(
              {
                version: 1,
                primaryTranslationId: localeDefaultPrimary,
                contrastTranslationIds: [],
                audioTranslationId: null,
              },
              index,
            );
            await writeReadBibleTranslationPrefMode("auto");
            await syncHomeVersePrefsFromPrimary(index, normalized.primaryTranslationId, { mode: "auto" });
          } else {
            const prefs = await readReadBibleTranslationPrefs(index, locale);
            normalized = await writeReadBibleTranslationPrefs(prefs, index);
            const mode = await readReadBibleTranslationPrefMode();
            if (mode === "auto") {
              await syncHomeVersePrefsFromPrimary(index, normalized.primaryTranslationId, { mode: "auto" });
            }
          }
          if (!cancelled) {
            setTranslation(normalized);
            void preloadPrimaryScriptureTranslation(normalized.primaryTranslationId);
          }
        };

        await applyCatalog(offlineIndex);

        void (async () => {
          try {
            const index = await fetchBibleTranslationsCatalogFresh();
            if (cancelled) return;
            if (index.translations.length <= offlineIndex.translations.length) return;
            await applyCatalog(index);
          } catch {
            /* 保留已就绪的内置目录 */
          }
        })();
      } catch {
        /* 内置目录已在上方同步就绪 */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!translationCatalogReady) return;
    return subscribeLocale(() => {
      void syncAutoTranslationForLocale();
    });
  }, [translationCatalogReady, syncAutoTranslationForLocale]);

  const refreshTranslationCatalog = useCallback(async () => {
    // 本地包目录固定：清缓存只会拖慢设置/菜单，无收益。
    if (!isMobileBundledOnly()) {
      await clearBibleTranslationsCatalogCache();
    }
    const index = await fetchBibleTranslationsCatalogFresh();
    if (index.translations.length <= bundledBibleTranslationsCatalog().translations.length) return;
    setTranslationCatalog((prev) => {
      if (
        prev.length === index.translations.length &&
        prev.every((item, i) => item.id === index.translations[i]?.id)
      ) {
        return prev;
      }
      return index.translations;
    });
    setDefaultTranslationId(index.defaultTranslationId);
    setTranslationCatalogReady(true);
    const locale = getLocale();
    const prefs = await readReadBibleTranslationPrefs(index, locale);
    const normalized = await writeReadBibleTranslationPrefs(prefs, index);
    setTranslation((prev) => {
      const sameContrast =
        prev.contrastTranslationIds.length === normalized.contrastTranslationIds.length &&
        prev.contrastTranslationIds.every((id, i) => id === normalized.contrastTranslationIds[i]);
      if (
        prev.primaryTranslationId === normalized.primaryTranslationId &&
        prev.audioTranslationId === normalized.audioTranslationId &&
        sameContrast
      ) {
        return prev;
      }
      return normalized;
    });
  }, []);

  return {
    translation,
    setTranslation,
    translationCatalog,
    translationCatalogReady,
    translationIndex,
    refreshTranslationCatalog,
  };
}
