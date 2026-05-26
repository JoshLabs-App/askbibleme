/**
 * Metro 需静态 `require` 各译本 SQLite；与 `data/bible/translations.json` 及
 * `npm run mobile:sync-scripture` 复制的 `assets/scripture/*.sqlite` 保持一致。
 */
export const BUNDLED_SCRIPTURE_TRANSLATION_IDS = [
  "bbe-en",
  "cuv-simp",
  "cuv-trad",
  "heb-leningrad",
  "rv1909-es",
  "web-en",
] as const;

export type BundledScriptureTranslationId = (typeof BUNDLED_SCRIPTURE_TRANSLATION_IDS)[number];

const BUNDLED_SCRIPTURE_ASSETS: Record<BundledScriptureTranslationId, number> = {
  "bbe-en": require("../../assets/scripture/bbe-en.sqlite"),
  "cuv-simp": require("../../assets/scripture/cuv-simp.sqlite"),
  "cuv-trad": require("../../assets/scripture/cuv-trad.sqlite"),
  "heb-leningrad": require("../../assets/scripture/heb-leningrad.sqlite"),
  "rv1909-es": require("../../assets/scripture/rv1909-es.sqlite"),
  "web-en": require("../../assets/scripture/web-en.sqlite"),
};

export function isBundledScriptureTranslation(id: string): id is BundledScriptureTranslationId {
  return (BUNDLED_SCRIPTURE_TRANSLATION_IDS as readonly string[]).includes(id);
}

export function getBundledScriptureAssetModule(id: string): number | null {
  if (!isBundledScriptureTranslation(id)) return null;
  return BUNDLED_SCRIPTURE_ASSETS[id];
}
