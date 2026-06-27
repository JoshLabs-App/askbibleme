import { useCallback, useEffect, useMemo, useState } from "react";
import { InteractionManager } from "react-native";
import { fetchBibleTranslationsCatalog } from "../api/fetchBibleTranslationsCatalog";
import type { BibleTranslationMeta } from "../bible/translations-types";
import { resolveUiText } from "../i18n/site-copy";
import { useLocale } from "../i18n/LocaleProvider";
import {
  defaultHomePrimaryTranslationIdForLocale,
  DEFAULT_HOME_PRAYER_PREFS,
  readHomePrayerVersePrefs,
  verseTranslationIdsFromPrefs,
  writeHomePrayerVersePrefs,
  type HomePrayerVersePrefsV1,
} from "./homePrayerVersePrefs";
import {
  CONTRAST_OFF_ID,
  PRIMARY_SYSTEM_DEFAULT_ID,
  toTranslationSelectOptions,
} from "./natureHomeTranslationLabels";
import type { NatureHomeSettingsSelectOption } from "./NatureHomeSettingsSelect";
import {
  attachNatureHomeTranslationDownloadStates,
  useNatureHomeTranslationInstallStates,
} from "./useNatureHomeTranslationInstallStates";

export type OpenTranslationMenu = "primary" | "contrast" | null;

function translationUsable(
  translationId: string,
  installStates: Record<string, import("../bible/scripture-translation-update").ScriptureTranslationInstallStatus>,
): boolean {
  const status = installStates[translationId];
  return status === "bundled" || status === "installed" || status === "outdated";
}

export function useNatureHomeTranslationSettings(onPrefsChanged: () => void) {
  const { locale } = useLocale();
  const [prefs, setPrefs] = useState<HomePrayerVersePrefsV1>(DEFAULT_HOME_PRAYER_PREFS);
  const [openMenu, setOpenMenu] = useState<OpenTranslationMenu>(null);
  const [catalog, setCatalog] = useState<BibleTranslationMeta[]>([]);

  const {
    installStates,
    translationDownloadState,
    setOpenMenuTracked,
    onDownloadTranslation,
    ensureTranslationDownloaded,
    isTranslationReady,
  } = useNatureHomeTranslationInstallStates(catalog);

  useEffect(() => {
    setOpenMenuTracked(openMenu);
  }, [openMenu, setOpenMenuTracked]);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void fetchBibleTranslationsCatalog().then((index) => {
        if (!cancelled) setCatalog(index.translations);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void readHomePrayerVersePrefs().then((p) => {
        if (!cancelled) setPrefs(p);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  const allOptions = useMemo(() => toTranslationSelectOptions(catalog, locale), [catalog, locale]);
  const allOptionsWithDownload = useMemo(
    () =>
      attachNatureHomeTranslationDownloadStates(allOptions, installStates, translationDownloadState),
    [allOptions, installStates, translationDownloadState],
  );

  const localeDefaultPrimaryId = useMemo(
    () => defaultHomePrimaryTranslationIdForLocale(locale),
    [locale],
  );

  const resolvedIds = useMemo(() => verseTranslationIdsFromPrefs(prefs, locale), [prefs, locale]);
  const primaryId = resolvedIds.primary;
  const contrastId = prefs.verseTextEnTranslationId;

  const persist = useCallback(
    async (next: HomePrayerVersePrefsV1) => {
      const normalized: HomePrayerVersePrefsV1 = { ...next };
      if (
        catalog.length > 0 &&
        !catalog.some((x) => x.id === normalized.verseTextZhTranslationId)
      ) {
        normalized.verseTextZhTranslationId = catalog[0]!.id;
      }
      const contrastVal = normalized.verseTextEnTranslationId.trim();
      if (contrastVal && !catalog.some((x) => x.id === contrastVal)) {
        normalized.verseTextEnTranslationId = "";
      }
      if (
        contrastVal &&
        contrastVal === normalized.verseTextZhTranslationId.trim()
      ) {
        normalized.verseTextEnTranslationId = "";
      }
      await writeHomePrayerVersePrefs(normalized);
      setPrefs(normalized);
      onPrefsChanged();
    },
    [catalog, onPrefsChanged],
  );

  useEffect(() => {
    if (catalog.length === 0) return;
    const primaryOk = catalog.some((x) => x.id === prefs.verseTextZhTranslationId);
    const contrastVal = prefs.verseTextEnTranslationId.trim();
    const contrastOk = !contrastVal || catalog.some((x) => x.id === contrastVal);
    if (primaryOk && contrastOk) return;
    void persist({
      ...prefs,
      verseTextZhTranslationId: primaryOk ? prefs.verseTextZhTranslationId : catalog[0]!.id,
      verseTextEnTranslationId: contrastOk ? prefs.verseTextEnTranslationId : "",
    });
  }, [catalog, prefs, persist]);

  useEffect(() => {
    if (catalog.length === 0) return;
    if (prefs.primaryTranslationMode !== "auto") return;
    const targetPrimary = defaultHomePrimaryTranslationIdForLocale(locale);
    if (!catalog.some((x) => x.id === targetPrimary)) return;
    if (prefs.verseTextEnTranslationId.trim() !== targetPrimary) return;
    void persist({
      ...prefs,
      verseTextEnTranslationId: "",
    });
  }, [catalog, locale, persist, prefs]);

  useEffect(() => {
    if (catalog.length === 0 || Object.keys(installStates).length === 0) return;
    const manualPrimary = prefs.primaryTranslationMode === "manual" ? prefs.verseTextZhTranslationId.trim() : "";
    const contrastVal = prefs.verseTextEnTranslationId.trim();
    const primaryMissing = manualPrimary && !translationUsable(manualPrimary, installStates);
    const contrastMissing = contrastVal && !translationUsable(contrastVal, installStates);
    if (!primaryMissing && !contrastMissing) return;

    const nextAutoPrimary = catalog.some((x) => x.id === localeDefaultPrimaryId)
      ? localeDefaultPrimaryId
      : catalog.find((x) => translationUsable(x.id, installStates))?.id ?? catalog[0]!.id;

    void persist({
      ...prefs,
      primaryTranslationMode: primaryMissing ? "auto" : prefs.primaryTranslationMode,
      verseTextZhTranslationId: primaryMissing ? nextAutoPrimary : prefs.verseTextZhTranslationId,
      verseTextEnTranslationId: contrastMissing ? "" : prefs.verseTextEnTranslationId,
    });
  }, [catalog, installStates, localeDefaultPrimaryId, persist, prefs]);

  const systemDefaultPrimaryLabel = resolveUiText(locale, "系统默认", "System default");

  const systemDefaultPrimaryOption = useMemo((): NatureHomeSettingsSelectOption => {
    const matched = allOptionsWithDownload.find((opt) => opt.id === localeDefaultPrimaryId);
    if (!matched) {
      return {
        id: PRIMARY_SYSTEM_DEFAULT_ID,
        label: systemDefaultPrimaryLabel,
        shortLabel: systemDefaultPrimaryLabel,
      };
    }
    return {
      id: PRIMARY_SYSTEM_DEFAULT_ID,
      label: `${systemDefaultPrimaryLabel} · ${matched.label}`,
      shortLabel: systemDefaultPrimaryLabel,
    };
  }, [allOptionsWithDownload, localeDefaultPrimaryId, systemDefaultPrimaryLabel]);

  const primaryOptions = useMemo(
    (): NatureHomeSettingsSelectOption[] => [systemDefaultPrimaryOption, ...allOptionsWithDownload],
    [systemDefaultPrimaryOption, allOptionsWithDownload],
  );

  const contrastOptions = useMemo((): NatureHomeSettingsSelectOption[] => {
    const contrastOffLabel = resolveUiText(locale, "无对照", "No contrast");
    return [
      {
        id: CONTRAST_OFF_ID,
        label: contrastOffLabel,
        shortLabel: contrastOffLabel,
      },
      ...allOptionsWithDownload,
    ];
  }, [allOptionsWithDownload, locale]);

  const primaryValue = prefs.primaryTranslationMode === "auto"
    ? PRIMARY_SYSTEM_DEFAULT_ID
    : allOptions.some((o) => o.id === primaryId)
      ? primaryId
      : allOptions[0]?.id ?? PRIMARY_SYSTEM_DEFAULT_ID;

  const contrastValue =
    !contrastId.trim() || !catalog.some((x) => x.id === contrastId)
      ? CONTRAST_OFF_ID
      : contrastId;

  const selectPrimary = useCallback(
    (id: string) => {
      if (id === PRIMARY_SYSTEM_DEFAULT_ID) {
        setOpenMenu(null);
        const nextAutoPrimary = catalog.some((x) => x.id === localeDefaultPrimaryId)
          ? localeDefaultPrimaryId
          : catalog[0]!.id;
        const nextContrast =
          prefs.verseTextEnTranslationId.trim() === nextAutoPrimary ? "" : prefs.verseTextEnTranslationId;
        void persist({
          ...prefs,
          primaryTranslationMode: "auto",
          verseTextZhTranslationId: nextAutoPrimary,
          verseTextEnTranslationId: nextContrast,
        });
        return;
      }
      void (async () => {
        try {
          await ensureTranslationDownloaded(id);
          setOpenMenu(null);
          const nextContrast =
            prefs.verseTextEnTranslationId.trim() === id
              ? ""
              : prefs.verseTextEnTranslationId;
          await persist({
            ...prefs,
            primaryTranslationMode: "manual",
            verseTextZhTranslationId: id,
            verseTextEnTranslationId: nextContrast,
          });
        } catch {
          /* download state surfaced via translationDownloadState */
        }
      })();
    },
    [catalog, ensureTranslationDownloaded, localeDefaultPrimaryId, persist, prefs],
  );

  const selectContrast = useCallback(
    (id: string) => {
      if (id === CONTRAST_OFF_ID) {
        setOpenMenu(null);
        void persist({
          ...prefs,
          verseTextEnTranslationId: "",
        });
        return;
      }
      void (async () => {
        try {
          await ensureTranslationDownloaded(id);
          setOpenMenu(null);
          await persist({
            ...prefs,
            verseTextEnTranslationId: id,
          });
        } catch {
          /* download state surfaced via translationDownloadState */
        }
      })();
    },
    [ensureTranslationDownloaded, persist, prefs],
  );

  const onDownloadOption = useCallback(
    (id: string) => {
      void onDownloadTranslation(id);
    },
    [onDownloadTranslation],
  );

  return {
    locale,
    catalog,
    allOptions: allOptionsWithDownload,
    openMenu,
    setOpenMenu,
    primaryOptions,
    contrastOptions,
    primaryValue,
    contrastValue,
    contrastId,
    selectPrimary,
    selectContrast,
    onDownloadOption,
    isTranslationReady,
  };
}
