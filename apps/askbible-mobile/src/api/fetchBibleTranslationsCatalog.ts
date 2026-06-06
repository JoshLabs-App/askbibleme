import { BUNDLED_SCRIPTURE_TRANSLATION_IDS } from "../bible/bundled-scripture-translations";
import type { BibleTranslationMeta, BibleTranslationsIndex } from "../bible/translations-types";

const BUNDLED_SET = new Set<string>(BUNDLED_SCRIPTURE_TRANSLATION_IDS);

function filterBundledTranslations(translations: BibleTranslationMeta[]): BibleTranslationMeta[] {
  return translations.filter((t) => BUNDLED_SET.has(t.id));
}

const BUNDLED_INDEX: BibleTranslationsIndex = {
  translations: filterBundledTranslations([
    {
      id: "asv",
      labelZh: "ASV 英文标准本",
      labelEn: "American Standard Version (ASV)",
      language: "en",
    },
    {
      id: "cuv-simp",
      labelZh: "和合本（简体）",
      labelEn: "Chinese Union Version (Simplified)",
      language: "zh-Hans",
    },
    {
      id: "cuv-trad",
      labelZh: "和合本（繁體）",
      labelEn: "Chinese Union Version (Traditional)",
      language: "zh-Hant",
    },
    {
      id: "otb-zh-hans",
      labelZh: "Open Bible（简体）",
      labelEn: "Open Translation Bible (Simplified Chinese)",
      language: "zh-Hans",
    },
    {
      id: "otb-zh-hant",
      labelZh: "Open Bible（繁體）",
      labelEn: "Open Translation Bible (Traditional Chinese)",
      language: "zh-Hant",
    },
    {
      id: "otb-en-gb",
      labelZh: "Open Bible（英文）",
      labelEn: "Open Translation Bible (English, en-GB)",
      language: "en",
    },
    {
      id: "web-en",
      labelZh: "WEB 英译本",
      labelEn: "World English Bible",
      language: "en",
    },
    {
      id: "bbe-en",
      labelZh: "BBE 简易英文",
      labelEn: "Bible in Basic English (BBE)",
      language: "en",
    },
    {
      id: "blm-es",
      labelZh: "西班牙语 自由世界圣经",
      labelEn: "Spanish Free Bible for the World",
      language: "es",
    },
    {
      id: "cbs-zh",
      labelZh: "中文当代译本（简体）",
      labelEn: "Mandarin Chinese Open Contemporary Bible (Simplified)",
      language: "zh-Hans",
    },
    {
      id: "dby-en",
      labelZh: "Darby 英译本",
      labelEn: "Darby Translation",
      language: "en",
    },
    {
      id: "gnv-en",
      labelZh: "Geneva 1599 英译本",
      labelEn: "Geneva Bible 1599",
      language: "en",
    },
    {
      id: "rv1909-es",
      labelZh: "西班牙语 Reina-Valera 1909",
      labelEn: "Reina-Valera 1909 (Spanish)",
      language: "es",
    },
    {
      id: "rvg-es",
      labelZh: "西班牙语 RVG",
      labelEn: "Reina Valera Gomez (Spanish)",
      language: "es",
    },
    {
      id: "swcb-zh",
      labelZh: "世界中文圣经",
      labelEn: "World Chinese Bible",
      language: "zh-Hans",
    },
    {
      id: "vbl-es",
      labelZh: "西班牙语 自由圣经译本",
      labelEn: "Spanish Free Bible Version",
      language: "es",
    },
    {
      id: "heb-leningrad",
      labelZh: "希伯来语 · Leningrad Codex",
      labelEn: "Hebrew (Leningrad / WLC-style)",
      language: "he",
    },
    {
      id: "kjv",
      labelZh: "KJV 英文钦定本",
      labelEn: "King James Version (KJV)",
      language: "en",
    },
    {
      id: "ylt-en",
      labelZh: "YLT 杨氏直译本",
      labelEn: "Young's Literal Translation (YLT)",
      language: "en",
    },
  ]),
  defaultTranslationId: "cuv-simp",
};

/** 同步内置译本表（APK 内打包译本 id 子集） */
export function bundledBibleTranslationsCatalog(): BibleTranslationsIndex {
  return BUNDLED_INDEX;
}

/** 移动版仅读本机目录，不请求 askbible.me */
export async function fetchBibleTranslationsCatalog(): Promise<BibleTranslationsIndex> {
  return BUNDLED_INDEX;
}
