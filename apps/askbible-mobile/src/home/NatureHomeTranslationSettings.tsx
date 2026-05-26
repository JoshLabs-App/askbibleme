import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { bundledBibleTranslationsCatalog } from "../api/fetchBibleTranslationsCatalog";
import type { BibleTranslationMeta } from "../bible/translations-types";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import {
  defaultHomePrimaryTranslationIdForLocale,
  DEFAULT_HOME_PRAYER_PREFS,
  readHomePrayerVersePrefs,
  verseTranslationIdsFromPrefs,
  writeHomePrayerVersePrefs,
  type HomePrayerVersePrefsV1,
} from "./homePrayerVersePrefs";
import {
  NatureHomeSettingsSelect,
  type NatureHomeSettingsSelectOption,
} from "./NatureHomeSettingsSelect";

const CONTRAST_OFF_ID = "";

type Props = {
  onPrefsChanged: () => void;
};

const SHORT_LABEL_ZH: Record<string, string> = {
  "cuv-simp": "和合本",
  "cuv-trad": "繁体",
  "web-en": "WEB",
  "bbe-en": "BBE",
  "heb-leningrad": "希伯来",
  "rv1909-es": "西语",
};

const SHORT_LABEL_EN: Record<string, string> = {
  "cuv-simp": "CUV",
  "cuv-trad": "CUV Trad",
  "web-en": "WEB",
  "bbe-en": "BBE",
  "heb-leningrad": "Hebrew",
  "rv1909-es": "Spanish",
};

function translationShortLabel(tr: BibleTranslationMeta, locale: "zh-CN" | "en"): string {
  const short = locale === "zh-CN" ? SHORT_LABEL_ZH[tr.id] : SHORT_LABEL_EN[tr.id];
  if (short) return short;
  return locale === "zh-CN" ? tr.labelZh : tr.labelEn;
}

function toOptions(catalog: BibleTranslationMeta[], locale: "zh-CN" | "en"): NatureHomeSettingsSelectOption[] {
  return catalog.map((tr) => ({
    id: tr.id,
    label: locale === "zh-CN" ? tr.labelZh : tr.labelEn,
    shortLabel: translationShortLabel(tr, locale),
  }));
}

type OpenMenu = "primary" | "contrast" | null;

export function NatureHomeTranslationSettings({ onPrefsChanged }: Props) {
  const { locale } = useLocale();
  const [prefs, setPrefs] = useState<HomePrayerVersePrefsV1>(DEFAULT_HOME_PRAYER_PREFS);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const catalog = useMemo(() => bundledBibleTranslationsCatalog().translations, []);
  const contrastOffLabel = t("pages.read.typography.contrastNone");

  useEffect(() => {
    let cancelled = false;
    void readHomePrayerVersePrefs().then((p) => {
      if (!cancelled) setPrefs(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const allOptions = useMemo(() => toOptions(catalog, locale), [catalog, locale]);

  const contrastOptions = useMemo((): NatureHomeSettingsSelectOption[] => {
    const none: NatureHomeSettingsSelectOption = {
      id: CONTRAST_OFF_ID,
      label: contrastOffLabel,
      shortLabel: contrastOffLabel,
    };
    return [none, ...allOptions];
  }, [allOptions, contrastOffLabel]);

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

  if (allOptions.length === 0) return null;

  const primaryValue = allOptions.some((o) => o.id === primaryId)
    ? primaryId
    : allOptions[0]!.id;
  const contrastValue =
    !contrastId.trim() || !catalog.some((x) => x.id === contrastId)
      ? CONTRAST_OFF_ID
      : contrastId;

  const primaryDisplay =
    allOptions.find((o) => o.id === primaryValue)?.shortLabel ??
    allOptions.find((o) => o.id === primaryValue)?.label ??
    primaryValue;
  const contrastDisplay =
    contrastOptions.find((o) => o.id === contrastValue)?.shortLabel ??
    contrastOptions.find((o) => o.id === contrastValue)?.label ??
    contrastOffLabel;

  return (
    <View style={styles.row}>
      <View style={styles.selectRow}>
        <NatureHomeSettingsSelect
          style={styles.select}
          menuPlacement="above"
          accessibilityLabel={primaryDisplay}
          value={primaryValue}
          options={allOptions}
          open={openMenu === "primary"}
          onOpenChange={(open) => setOpenMenu(open ? "primary" : null)}
          onSelect={(id) => {
            setOpenMenu(null);
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
          }}
        />
        <NatureHomeSettingsSelect
          style={styles.select}
          menuPlacement="above"
          accessibilityLabel={contrastDisplay}
          value={contrastValue}
          options={contrastOptions}
          open={openMenu === "contrast"}
          onOpenChange={(open) => setOpenMenu(open ? "contrast" : null)}
          onSelect={(id) => {
            setOpenMenu(null);
            const nextContrast = id === CONTRAST_OFF_ID ? "" : id;
            void persist({
              ...prefs,
              verseTextEnTranslationId: nextContrast,
            });
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
  },
  selectRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  select: {
    flex: 1,
    minWidth: 72,
  },
});
