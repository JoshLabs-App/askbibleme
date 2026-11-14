/**
 * 和合本那几个译本改读**本地库**，不再抓 bible.com（Josh 2026-09-23：「1 改」）。
 * 纯常量，服务端加载器与网页客户端读经页共用，避免两边各写一份而漂移。
 * 对应关系与「上帝版不在表里」的说明见 lib/bible/load-chapter-from-default-translation.ts。
 */
export const LOCAL_SUBSTITUTE_TRANSLATION_IDS: Record<string, string> = {
  "cunpss-zh-hans": "cuv-simp",
  "cunpss-zh-hant": "cuv-trad",
  "cunp-zh-hant": "cuv-trad",
};
