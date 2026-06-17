import { toZhTwText } from "../i18n/site-copy";

const SHORT_LABEL_ZH: Record<string, string> = {
  asv: "ASV",
  "cuv-simp": "和合本",
  "cuv-trad": "繁体",
  "otb-zh-hans": "Open简体",
  "otb-zh-hant": "Open繁体",
  "otb-en-gb": "Open英",
  "web-en": "WEB",
  "bbe-en": "BBE",
  "blm-es": "BLM",
  "cbs-zh": "当代",
  "heb-leningrad": "希伯来",
  "dby-en": "Darby",
  "gnv-en": "Geneva",
  kjv: "KJV",
  "rv1909-es": "西语",
  "rvg-es": "RVG",
  "swcb-zh": "世中圣经",
  "vbl-es": "VBL",
  "ylt-en": "YLT",
  mandarin: "普通话",
  "teochew-nt": "潮汕语",
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
  "blm-es": "BLM",
  "cbs-zh": "當代",
  "heb-leningrad": "希伯來",
  "dby-en": "Darby",
  "gnv-en": "Geneva",
  kjv: "KJV",
  "rv1909-es": "西語",
  "rvg-es": "RVG",
  "swcb-zh": "世中聖經",
  "vbl-es": "VBL",
  "ylt-en": "YLT",
  mandarin: "普通話",
  "teochew-nt": "潮汕語",
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
  "blm-es": "BLM",
  "cbs-zh": "CCB",
  "heb-leningrad": "Hebrew",
  "dby-en": "Darby",
  "gnv-en": "Geneva",
  kjv: "KJV",
  "rv1909-es": "Spanish",
  "rvg-es": "RVG",
  "swcb-zh": "WCB",
  "vbl-es": "VBL",
  "ylt-en": "YLT",
  mandarin: "Mandarin",
  "teochew-nt": "Teochew",
};

export function shortLabel(id: string, locale: string, fallback: string): string {
  const map = locale === "en" ? SHORT_LABEL_EN : locale === "zh-TW" ? SHORT_LABEL_ZH_TW : SHORT_LABEL_ZH;
  return map[id] ?? fallback;
}

export function translationOptionLabel(
  tr: { labelZh: string; labelEn: string },
  locale: string,
): string {
  if (locale === "en") return tr.labelEn;
  return locale === "zh-TW" ? toZhTwText(tr.labelZh) : tr.labelZh;
}

function rankTranslationForPicker(id: string): number {
  if (id === "kjv") return 0;
  return 100;
}

export function sortPickerTranslations<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => rankTranslationForPicker(a.id) - rankTranslationForPicker(b.id));
}
