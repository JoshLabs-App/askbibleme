/**
 * Metro 需静态 `require` 各译本 SQLite；与 `lib/bible/mobile-bundled-scripture-ids.ts` 及
 * `npm run mobile:sync-scripture` 复制的 `assets/scripture/*.sqlite` 保持一致。
 */
export const BUNDLED_SCRIPTURE_TRANSLATION_IDS = ["cuv-simp", "cuv-trad", "web-en", "kjv", "ust-en"] as const;

export type BundledScriptureTranslationId = (typeof BUNDLED_SCRIPTURE_TRANSLATION_IDS)[number];

const BUNDLED_SCRIPTURE_ASSETS: Record<BundledScriptureTranslationId, number> = {
  "cuv-simp": require("../../assets/scripture/cuv-simp.sqlite"),
  "cuv-trad": require("../../assets/scripture/cuv-trad.sqlite"),
  "web-en": require("../../assets/scripture/web-en.sqlite"),
  kjv: require("../../assets/scripture/kjv.sqlite"),
  "ust-en": require("../../assets/scripture/ust-en.sqlite"),
};

export function isBundledScriptureTranslation(id: string): id is BundledScriptureTranslationId {
  return (BUNDLED_SCRIPTURE_TRANSLATION_IDS as readonly string[]).includes(id);
}

export function getBundledScriptureAssetModule(id: string): number | null {
  if (!isBundledScriptureTranslation(id)) return null;
  return BUNDLED_SCRIPTURE_ASSETS[id];
}
