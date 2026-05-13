/** 外部清单 / 策展数据在仓库内的可追溯来源（计划：sourceName、条款摘要等）。 */
export type ScriptureSourceMeta = {
  sourceName?: string;
  sourceUrl?: string;
  licenseOrTermsNote?: string;
  retrievedAt?: string;
  snapshotVersion?: string;
};
