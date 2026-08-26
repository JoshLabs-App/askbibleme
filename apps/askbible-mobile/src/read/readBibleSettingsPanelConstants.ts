import { toZhTwText } from "../i18n/site-copy";
export { sortPickerTranslations } from "./readBibleTranslationPickerOrderModel";

const SHORT_LABEL_ZH: Record<string, string> = {
  asv: "ASV",
  "cuv-simp": "和合本",
  "cuv-trad": "和合本繁",
  "otb-zh-hans": "Open简体",
  "otb-zh-hant": "Open繁体",
  "otb-en-gb": "Open英",
  niv: "NIV",
  esv: "ESV",
  nlt: "NLT",
  nkjv: "NKJV",
  "web-en": "WEBP",
  "bbe-en": "BBE",
  "blm-es": "BLM",
  "cbs-zh": "当代",
  "ccb-zh-hans": "当代译本",
  "ccb-zh-hant": "当代译本",
  "cnv-zh-hant": "新译本",
  "cnvs-zh-hans": "新译本",
  "csbs-zh-hans": "标准译本",
  "csbt-zh-hant": "标准译本",
  "cunp-zh-hant": "新标点·神繁",
  "cunp-zh-hant-god": "新标点·上帝繁",
  "cunpss-zh-hant": "新标点·上帝简",
  "cunpss-zh-hans": "新标点·神简",
  "feb-zh-hans": "易读圣经",
  "mandarin-zh-hans": "普通话",
  "rcuv-zh-hant": "和合本修订",
  "rcuvss-zh-hans": "和合本修订",
  "rcv-zh-hant": "恢复本",
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
  "cuv-trad": "和合本繁",
  "otb-zh-hans": "Open簡體",
  "otb-zh-hant": "Open繁體",
  "otb-en-gb": "Open英",
  niv: "NIV",
  esv: "ESV",
  nlt: "NLT",
  nkjv: "NKJV",
  "web-en": "WEBP",
  "bbe-en": "BBE",
  "blm-es": "BLM",
  "cbs-zh": "當代",
  "ccb-zh-hans": "當代譯本",
  "ccb-zh-hant": "當代譯本",
  "cnv-zh-hant": "新譯本",
  "cnvs-zh-hans": "新譯本",
  "csbs-zh-hans": "標準譯本",
  "csbt-zh-hant": "標準譯本",
  "cunp-zh-hant": "新標點·神繁",
  "cunp-zh-hant-god": "新標點·上帝繁",
  "cunpss-zh-hant": "新標點·上帝簡",
  "cunpss-zh-hans": "新標點·神簡",
  "feb-zh-hans": "易讀聖經",
  "mandarin-zh-hans": "普通話",
  "rcuv-zh-hant": "和合本修訂",
  "rcuvss-zh-hans": "和合本修訂",
  "rcv-zh-hant": "恢復本",
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
  niv: "NIV",
  esv: "ESV",
  nlt: "NLT",
  nkjv: "NKJV",
  "web-en": "WEBP",
  "bbe-en": "BBE",
  "blm-es": "BLM",
  "cbs-zh": "CCB",
  "ccb-zh-hans": "CCB",
  "ccb-zh-hant": "CCB",
  "cnv-zh-hant": "CNV",
  "cnvs-zh-hans": "CNVS",
  "csbs-zh-hans": "CSBS",
  "csbt-zh-hant": "CSBT",
  "cunp-zh-hant": "CUNP Shen",
  "cunp-zh-hant-god": "CUNP Shangdi",
  "cunpss-zh-hant": "CUNPSS Shangdi",
  "cunpss-zh-hans": "CUNPSS Shen",
  "feb-zh-hans": "FEB",
  "mandarin-zh-hans": "Mandarin",
  "rcuv-zh-hant": "RCUV",
  "rcuvss-zh-hans": "RCUVSS",
  "rcv-zh-hant": "RCV",
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

function isAsciiCodeLabel(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value.trim());
}

function isLikelyChineseTranslationId(id: string): boolean {
  return /(^|-)(zh|cuv|cbs|swcb|cnv|cnvs|rcuv|cunp|ccb|csb|rcv|tcv|feb|mandarin|teochew|otb-zh)/i.test(
    id,
  );
}

/** 中文界面闭合态短名：去掉括号附注，避免挤爆设置行 */
function compactZhShortLabel(label: string): string {
  return label
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/,\s*.+$/, "")
    .replace(/\s+/g, "")
    .trim();
}

export function shortLabel(id: string, locale: string, fallback: string): string {
  const map = locale === "en" ? SHORT_LABEL_EN : locale === "zh-TW" ? SHORT_LABEL_ZH_TW : SHORT_LABEL_ZH;
  const mapped = map[id];
  if (locale === "en") return mapped ?? fallback;

  const zhFallback = compactZhShortLabel(fallback);
  if (!mapped) return zhFallback || fallback;
  // 中文界面的中文译本：不用 CNV / RCUV 这类英文缩写
  if (isAsciiCodeLabel(mapped) && isLikelyChineseTranslationId(id) && zhFallback) {
    return zhFallback;
  }
  return mapped;
}

export function translationOptionLabel(
  tr: { labelZh: string; labelEn: string },
  locale: string,
): string {
  if (locale === "en") return tr.labelEn;
  return locale === "zh-TW" ? toZhTwText(tr.labelZh) : tr.labelZh;
}
