"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  NatureHomeSettingsSelect,
  type NatureHomeSettingsSelectOption,
} from "@/components/nature/NatureHomeSettingsSelect";
import { HOME_BIBLE_TRANSLATIONS_CATALOG_URL } from "@/lib/home-prayer-pools/constants";
import {
  defaultHomePrimaryTranslationIdForLocale,
  readHomePrayerVersePrefs,
  requestHomePrayerVerseFeedReload,
  verseTranslationIdsFromPrefs,
  writeHomePrayerVersePrefs,
} from "@/lib/home-prayer-pools/prefs";
import type { HomePrayerVersePrefsV1 } from "@/lib/home-prayer-pools/types";
import type { AppLocale } from "@/lib/i18n/config";

const CONTRAST_OFF_ID = "";
const PRIMARY_SYSTEM_DEFAULT_ID = "__system_default__";

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

type Catalog = { version: 1; translations: { id: string; labelZh: string; labelEn: string; language: string }[] };

function translationShortLabel(id: string, labelZh: string, labelEn: string, locale: AppLocale): string {
  const short = locale === "en" ? SHORT_LABEL_EN[id] : SHORT_LABEL_ZH[id];
  if (short) return short;
  return locale === "en" ? labelEn : labelZh;
}

function toOptions(catalog: Catalog["translations"], locale: AppLocale): NatureHomeSettingsSelectOption[] {
  return [...catalog]
    .sort((a, b) => {
      const rank = (id: string) => (id === "kjv" ? 0 : id === "cuv-simp" ? 1 : id === "cuv-trad" ? 2 : 100);
      return rank(a.id) - rank(b.id);
    })
    .map((tr) => ({
      id: tr.id,
      label: locale === "en" ? tr.labelEn : tr.labelZh,
      shortLabel: translationShortLabel(tr.id, tr.labelZh, tr.labelEn, locale),
    }));
}

type Props = {
  onPrefsChanged?: () => void;
};

type OpenMenu = "primary" | "contrast" | null;

/** 对齐 App `NatureHomeTranslationSettings`：系统默认 + 主译本 / 对照译本 */
export function NatureHomeTranslationSettings({ onPrefsChanged }: Props) {
  const { locale, t } = useLocale();
  const [prefs, setPrefs] = useState<HomePrayerVersePrefsV1>(() => readHomePrayerVersePrefs());
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(HOME_BIBLE_TRANSLATIONS_CATALOG_URL, { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.version === 1 && Array.isArray(data.translations)) {
          setCatalog(data as Catalog);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const allOptions = useMemo(
    () => toOptions(catalog?.translations ?? [], locale),
    [catalog, locale],
  );

  const localeDefaultPrimaryId = useMemo(
    () => defaultHomePrimaryTranslationIdForLocale(locale),
    [locale],
  );

  const contrastOffLabel = t("pages.read.typography.contrastNone");

  const contrastOptions = useMemo((): NatureHomeSettingsSelectOption[] => {
    return [{ id: CONTRAST_OFF_ID, label: contrastOffLabel, shortLabel: contrastOffLabel }, ...allOptions];
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
    (next: HomePrayerVersePrefsV1) => {
      const normalized = { ...next };
      if (catalog?.translations.length) {
        if (!catalog.translations.some((x) => x.id === normalized.verseTextZhTranslationId)) {
          normalized.verseTextZhTranslationId = catalog.translations[0]!.id;
        }
        const contrastVal = normalized.verseTextEnTranslationId.trim();
        if (contrastVal && !catalog.translations.some((x) => x.id === contrastVal)) {
          normalized.verseTextEnTranslationId = "";
        }
        if (contrastVal && contrastVal === normalized.verseTextZhTranslationId.trim()) {
          normalized.verseTextEnTranslationId = "";
        }
      }
      writeHomePrayerVersePrefs(normalized);
      setPrefs(normalized);
      requestHomePrayerVerseFeedReload();
      onPrefsChanged?.();
    },
    [catalog, onPrefsChanged],
  );

  useEffect(() => {
    if (!catalog?.translations.length) return;
    const primaryOk = catalog.translations.some((x) => x.id === prefs.verseTextZhTranslationId);
    const contrastVal = prefs.verseTextEnTranslationId.trim();
    const contrastOk = !contrastVal || catalog.translations.some((x) => x.id === contrastVal);
    if (primaryOk && contrastOk) return;
    persist({
      ...prefs,
      verseTextZhTranslationId: primaryOk ? prefs.verseTextZhTranslationId : catalog.translations[0]!.id,
      verseTextEnTranslationId: contrastOk ? prefs.verseTextEnTranslationId : "",
    });
  }, [catalog, prefs, persist]);

  useEffect(() => {
    if (!catalog?.translations.length) return;
    if (prefs.primaryTranslationMode !== "auto") return;
    const targetPrimary = defaultHomePrimaryTranslationIdForLocale(locale);
    if (!catalog.translations.some((x) => x.id === targetPrimary)) return;
    if (prefs.verseTextEnTranslationId.trim() !== targetPrimary) return;
    persist({
      ...prefs,
      verseTextEnTranslationId: "",
    });
  }, [catalog, locale, persist, prefs]);

  if (allOptions.length === 0) return null;

  const primaryValue =
    prefs.primaryTranslationMode === "auto"
      ? PRIMARY_SYSTEM_DEFAULT_ID
      : allOptions.some((o) => o.id === primaryId)
        ? primaryId
        : allOptions[0]!.id;
  const contrastValue =
    !contrastId.trim() || !catalog?.translations.some((x) => x.id === contrastId)
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
    <div className="relative w-max max-w-full">
      <div className="relative flex w-max gap-2">
        <NatureHomeSettingsSelect
          compact
          accessibilityLabel={primaryDisplay}
          value={primaryValue}
          options={primaryOptions}
          open={openMenu === "primary"}
          onOpenChange={(open) => setOpenMenu(open ? "primary" : null)}
          onSelect={(id) => {
            setOpenMenu(null);
            if (id === PRIMARY_SYSTEM_DEFAULT_ID) {
              const nextAutoPrimary = catalog?.translations.some((x) => x.id === localeDefaultPrimaryId)
                ? localeDefaultPrimaryId
                : catalog!.translations[0]!.id;
              const nextContrast =
                prefs.verseTextEnTranslationId.trim() === nextAutoPrimary ? "" : prefs.verseTextEnTranslationId;
              persist({
                ...prefs,
                primaryTranslationMode: "auto",
                verseTextZhTranslationId: nextAutoPrimary,
                verseTextEnTranslationId: nextContrast,
                verseDisplay: nextContrast.trim() ? "bilingual" : prefs.verseDisplay,
              });
              return;
            }
            const nextContrast =
              prefs.verseTextEnTranslationId.trim() === id ? "" : prefs.verseTextEnTranslationId;
            persist({
              ...prefs,
              primaryTranslationMode: "manual",
              verseTextZhTranslationId: id,
              verseTextEnTranslationId: nextContrast,
              verseDisplay: nextContrast.trim() ? "bilingual" : prefs.verseDisplay,
            });
          }}
        />
        <NatureHomeSettingsSelect
          compact
          accessibilityLabel={contrastDisplay}
          value={contrastValue}
          options={contrastOptions}
          open={openMenu === "contrast"}
          onOpenChange={(open) => setOpenMenu(open ? "contrast" : null)}
          onSelect={(id) => {
            setOpenMenu(null);
            persist({
              ...prefs,
              verseTextEnTranslationId: id === CONTRAST_OFF_ID ? "" : id,
              verseDisplay: id === CONTRAST_OFF_ID ? "primary" : "bilingual",
            });
          }}
        />
      </div>
    </div>
  );
}
