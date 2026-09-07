/**
 * App 安装包内置译本（简体/繁体和合本 + WEB + UST 学英文版）；与 `scripts/sync-mobile-scripture-sqlite.mjs` 保持一致。
 * KJV 2026-09 起改为按需下载（见 `MOBILE_SCRIPTURE_R2_DOWNLOAD_URLS`），不再默认打包——
 * 只省 5.7M，但换来「选它的用户按需拉一次、之后离线可读」而不是打包 App 时人人都背着这 5.7M。
 */
export const MOBILE_BUNDLED_SCRIPTURE_TRANSLATION_IDS = [
  "cuv-simp",
  "cuv-trad",
  "web-en",
  "ust-en",
] as const;

export type MobileBundledScriptureTranslationId =
  (typeof MOBILE_BUNDLED_SCRIPTURE_TRANSLATION_IDS)[number];

export function isMobileBundledScriptureTranslationId(id: string): id is MobileBundledScriptureTranslationId {
  return (MOBILE_BUNDLED_SCRIPTURE_TRANSLATION_IDS as readonly string[]).includes(id);
}
