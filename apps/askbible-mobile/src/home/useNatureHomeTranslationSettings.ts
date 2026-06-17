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

export type OpenTranslationMenu = "primary" | "contrast" | null;

export function useNatureHomeTranslationSettings(onPrefsChanged: () => void) {
  const { locale } = useLocale();
  const [prefs, setPrefs] = useState<HomePrayerVersePrefsV1>(DEFAULT_HOME_PRAYER_PREFS);
  const [openMenu, setOpenMenu] = useState<OpenTranslationMenu>(null);
  const [catalog, setCatalog] = useState<BibleTranslationMeta[]>([]);

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

  const systemDefaultPrimaryLabel = resolveUiText(locale, "系统默认", "System default");

  const systemDefaultPrimaryOption = useMemo((): NatureHomeSettingsSelectOption => {
    const matched = allOptions.find((opt) => opt.id === localeDefaultPrimaryId);
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
  }, [allOptions, localeDefaultPrimaryId, systemDefaultPrimaryLabel]);

  const primaryOptions = useMemo(
    (): NatureHomeSettingsSelectOption[] => [systemDefaultPrimaryOption, ...allOptions],
    [systemDefaultPrimaryOption, allOptions],
  );

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
      setOpenMenu(null);
      if (id === PRIMARY_SYSTEM_DEFAULT_ID) {
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
      const nextContrast =
        prefs.verseTextEnTranslationId.trim() === id
          ? ""
          : prefs.verseTextEnTranslationId;
      void persist({
        ...prefs,
        primaryTranslationMode: "manual",
        verseTextZhTranslationId: id,
        verseTextEnTranslationId: nextContrast,
      });
    },
    [catalog, localeDefaultPrimaryId, persist, prefs],
  );

  const selectContrast = useCallback(
    (id: string) => {
      setOpenMenu(null);
      const nextContrast = id === CONTRAST_OFF_ID ? "" : id;
      void persist({
        ...prefs,
        verseTextEnTranslationId: nextContrast,
      });
    },
    [persist, prefs],
  );

  return {
    locale,
    catalog,
    allOptions,
    openMenu,
    setOpenMenu,
    primaryOptions,
    primaryValue,
    contrastValue,
    contrastId,
    selectPrimary,
    selectContrast,
  };
}
