/**
 * Metro 需静态 `require` 各译本 SQLite；与 `data/bible/translations.json` 及
 * `npm run mobile:sync-scripture` 复制的 `assets/scripture/*.sqlite` 保持一致。
 */
export const BUNDLED_SCRIPTURE_TRANSLATION_IDS = [
  "asv",
  "bbe-en",
  "blm-es",
  "cbs-zh",
  "cuv-simp",
  "cuv-trad",
  "dby-en",
  "gnv-en",
  "heb-leningrad",
  "kjv",
  "otb-en-gb",
  "otb-zh-hans",
  "otb-zh-hant",
  "rv1909-es",
  "rvg-es",
  "swcb-zh",
  "vbl-es",
  "web-en",
  "ylt-en",
] as const;

export type BundledScriptureTranslationId = (typeof BUNDLED_SCRIPTURE_TRANSLATION_IDS)[number];

const BUNDLED_SCRIPTURE_ASSETS: Record<BundledScriptureTranslationId, number> = {
  asv: require("../../assets/scripture/asv.sqlite"),
  "bbe-en": require("../../assets/scripture/bbe-en.sqlite"),
  "blm-es": require("../../assets/scripture/blm-es.sqlite"),
  "cbs-zh": require("../../assets/scripture/cbs-zh.sqlite"),
  "cuv-simp": require("../../assets/scripture/cuv-simp.sqlite"),
  "cuv-trad": require("../../assets/scripture/cuv-trad.sqlite"),
  "dby-en": require("../../assets/scripture/dby-en.sqlite"),
  "gnv-en": require("../../assets/scripture/gnv-en.sqlite"),
  "heb-leningrad": require("../../assets/scripture/heb-leningrad.sqlite"),
  kjv: require("../../assets/scripture/kjv.sqlite"),
  "otb-en-gb": require("../../assets/scripture/otb-en-gb.sqlite"),
  "otb-zh-hans": require("../../assets/scripture/otb-zh-hans.sqlite"),
  "otb-zh-hant": require("../../assets/scripture/otb-zh-hant.sqlite"),
  "rv1909-es": require("../../assets/scripture/rv1909-es.sqlite"),
  "rvg-es": require("../../assets/scripture/rvg-es.sqlite"),
  "swcb-zh": require("../../assets/scripture/swcb-zh.sqlite"),
  "vbl-es": require("../../assets/scripture/vbl-es.sqlite"),
  "web-en": require("../../assets/scripture/web-en.sqlite"),
  "ylt-en": require("../../assets/scripture/ylt-en.sqlite"),
};

export function isBundledScriptureTranslation(id: string): id is BundledScriptureTranslationId {
  return (BUNDLED_SCRIPTURE_TRANSLATION_IDS as readonly string[]).includes(id);
}

export function getBundledScriptureAssetModule(id: string): number | null {
  if (!isBundledScriptureTranslation(id)) return null;
  return BUNDLED_SCRIPTURE_ASSETS[id];
}
