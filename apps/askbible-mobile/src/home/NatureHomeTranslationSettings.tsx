import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fetchBibleTranslationsCatalog } from "../api/fetchBibleTranslationsCatalog";
import type { BibleTranslationMeta } from "../bible/translations-types";
import type { AppLocale } from "../i18n/config";
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
const PRIMARY_SYSTEM_DEFAULT_ID = "__system_default__";

type Props = {
  onPrefsChanged: () => void;
};

const SHORT_LABEL_ZH: Record<string, string> = {
  asv: "ASV",
  "cuv-simp": "和合本",
  "cuv-trad": "繁体",
  "otb-zh-hans": "Open简体",
  "otb-zh-hant": "Open繁体",
  "otb-en-gb": "Open英",
  "web-en": "WEB",
  "bbe-en": "BBE",
  "heb-leningrad": "希伯来",
  kjv: "KJV",
  "rv1909-es": "西语",
};

const SHORT_LABEL_EN: Record<string, string> = {
  asv: "ASV",
  "cuv-simp": "CUV",
  "cuv-trad": "CUV Trad",
  "otb-zh-hans": "OTB ZH",
  "otb-zh-hant": "OTB ZH-T",
  "otb-en-gb": "OTB EN",
  "web-en": "WEB",
  "bbe-en": "BBE",
  "heb-leningrad": "Hebrew",
  kjv: "KJV",
  "rv1909-es": "Spanish",
};

function translationShortLabel(tr: BibleTranslationMeta, locale: AppLocale): string {
  const short = locale === "en" ? SHORT_LABEL_EN[tr.id] : SHORT_LABEL_ZH[tr.id];
  if (short) return short;
  return locale === "en" ? tr.labelEn : tr.labelZh;
}

function toOptions(catalog: BibleTranslationMeta[], locale: AppLocale): NatureHomeSettingsSelectOption[] {
  return [...catalog]
    .sort((a, b) => {
      const rank = (id: string): number => {
        if (id === "kjv") return 0;
        if (id === "cuv-simp") return 1;
        if (id === "cuv-trad") return 2;
        return 100;
      };
      const diff = rank(a.id) - rank(b.id);
      if (diff !== 0) return diff;
      return 0;
    })
    .map((tr) => ({
    id: tr.id,
    label: locale === "en" ? tr.labelEn : tr.labelZh,
    shortLabel: translationShortLabel(tr, locale),
    }));
}

type OpenMenu = "primary" | "contrast" | null;

export function NatureHomeTranslationSettings({ onPrefsChanged }: Props) {
  const { locale } = useLocale();
  const [prefs, setPrefs] = useState<HomePrayerVersePrefsV1>(DEFAULT_HOME_PRAYER_PREFS);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  const [catalog, setCatalog] = useState<BibleTranslationMeta[]>([]);
  const contrastOffLabel = t("pages.read.typography.contrastNone");

  useEffect(() => {
    let cancelled = false;
    void fetchBibleTranslationsCatalog().then((index) => {
      if (!cancelled) setCatalog(index.translations);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
  const localeDefaultPrimaryId = useMemo(
    () => defaultHomePrimaryTranslationIdForLocale(locale),
    [locale],
  );

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
  const systemDefaultPrimaryLabel = locale === "en" ? "System default" : "系统默认";
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

  const primaryValue = prefs.primaryTranslationMode === "auto"
    ? PRIMARY_SYSTEM_DEFAULT_ID
    : allOptions.some((o) => o.id === primaryId)
      ? primaryId
      : allOptions[0]!.id;
  const contrastValue =
    !contrastId.trim() || !catalog.some((x) => x.id === contrastId)
      ? CONTRAST_OFF_ID
      : contrastId;

  const primaryDisplay =
    primaryOptions.find((o) => o.id === primaryValue)?.shortLabel ??
    primaryOptions.find((o) => o.id === primaryValue)?.label ??
    primaryValue;
  const contrastDisplay =
    contrastOptions.find((o) => o.id === contrastValue)?.shortLabel ??
    contrastOptions.find((o) => o.id === contrastValue)?.label ??
    contrastOffLabel;

  return (
    <View style={styles.row}>
      <View style={styles.selectRow}>
        {openMenu ? (
          <Pressable
            style={styles.dismissOverlay}
            onPress={() => setOpenMenu(null)}
            accessibilityRole="button"
            accessibilityLabel={locale === "en" ? "Close translation dropdown" : "关闭译本下拉"}
          />
        ) : null}
        <NatureHomeSettingsSelect
          style={styles.select}
          accessibilityLabel={primaryDisplay}
          value={primaryValue}
          options={primaryOptions}
          open={openMenu === "primary"}
          onOpenChange={(open) => setOpenMenu(open ? "primary" : null)}
          onSelect={(id) => {
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
          }}
        />
        <NatureHomeSettingsSelect
          style={styles.select}
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
    position: "relative",
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  select: {
    flex: 1,
    minWidth: 72,
  },
});
