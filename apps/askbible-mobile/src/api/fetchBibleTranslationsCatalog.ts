import { BUNDLED_SCRIPTURE_TRANSLATION_IDS } from "../bible/bundled-scripture-translations";
import type { BibleTranslationMeta, BibleTranslationsIndex } from "../bible/translations-types";

const BUNDLED_SET = new Set<string>(BUNDLED_SCRIPTURE_TRANSLATION_IDS);

function filterBundledTranslations(translations: BibleTranslationMeta[]): BibleTranslationMeta[] {
  return translations.filter((t) => BUNDLED_SET.has(t.id));
}

const BUNDLED_INDEX: BibleTranslationsIndex = {
  translations: filterBundledTranslations([
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
      id: "rv1909-es",
      labelZh: "西班牙语 Reina-Valera 1909",
      labelEn: "Reina-Valera 1909 (Spanish)",
      language: "es",
    },
  ]),
  defaultTranslationId: "cuv-simp",
};

const FILTERED_BUNDLED_INDEX: BibleTranslationsIndex = {
  ...BUNDLED_INDEX,
  translations: BUNDLED_INDEX.translations.filter((t) => {
    const id = t.id.trim().toLowerCase();
    const lang = t.language.trim().toLowerCase();
    if (lang === "es" || lang.startsWith("es-")) return false;
    if (id.endsWith("-es") || id.includes("-es-")) return false;
    return true;
  }),
};

/** 同步内置译本表（APK 内打包译本 id 子集） */
export function bundledBibleTranslationsCatalog(): BibleTranslationsIndex {
  return FILTERED_BUNDLED_INDEX;
}

/** 移动版仅读本机目录，不请求 askbible.me */
export async function fetchBibleTranslationsCatalog(): Promise<BibleTranslationsIndex> {
  return FILTERED_BUNDLED_INDEX;
}
