/** App 安装包内置译本（简体/繁体和合本 + WEB + KJV）；与 `scripts/sync-mobile-scripture-sqlite.mjs` 保持一致。 */
export const MOBILE_BUNDLED_SCRIPTURE_TRANSLATION_IDS = [
  "cuv-simp",
  "cuv-trad",
  "web-en",
  "kjv",
] as const;

export type MobileBundledScriptureTranslationId =
  (typeof MOBILE_BUNDLED_SCRIPTURE_TRANSLATION_IDS)[number];

export function isMobileBundledScriptureTranslationId(id: string): id is MobileBundledScriptureTranslationId {
  return (MOBILE_BUNDLED_SCRIPTURE_TRANSLATION_IDS as readonly string[]).includes(id);
}
