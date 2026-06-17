import type { BibleTranslationMeta } from "../bible/translations-types";
import type { AppLocale } from "../i18n/config";
import { localizeZhText } from "../i18n/site-copy";
import type { NatureHomeSettingsSelectOption } from "./NatureHomeSettingsSelect";

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

const SHORT_LABEL_ZH_TW: Record<string, string> = {
  asv: "ASV",
  "cuv-simp": "和合本",
  "cuv-trad": "繁體",
  "otb-zh-hans": "Open簡體",
  "otb-zh-hant": "Open繁體",
  "otb-en-gb": "Open英",
  "web-en": "WEB",
  "bbe-en": "BBE",
  "heb-leningrad": "希伯來",
  kjv: "KJV",
  "rv1909-es": "西語",
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

export const CONTRAST_OFF_ID = "";
export const PRIMARY_SYSTEM_DEFAULT_ID = "__system_default__";

export function translationShortLabel(tr: BibleTranslationMeta, locale: AppLocale): string {
  const shortMap =
    locale === "en" ? SHORT_LABEL_EN : locale === "zh-TW" ? SHORT_LABEL_ZH_TW : SHORT_LABEL_ZH;
  const short = shortMap[tr.id];
  if (short) return short;
  return locale === "en" ? tr.labelEn : localizeZhText(locale, tr.labelZh);
}

export function toTranslationSelectOptions(
  catalog: BibleTranslationMeta[],
  locale: AppLocale,
): NatureHomeSettingsSelectOption[] {
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
      label: locale === "en" ? tr.labelEn : localizeZhText(locale, tr.labelZh),
      shortLabel: translationShortLabel(tr, locale),
    }));
}
