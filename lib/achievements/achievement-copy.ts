/**
 * 成就系统的三语文案：和原生**共用同一份真源** `tools/native-copy-extra.json`
 * （原生那边由 `npm run gen:site-copy` 生成 SiteCopy，网页端直接 import）。
 * 只写简体 + 英文，繁体运行时由 `toZhTwText` 转——和 `data/medals.json` 同一个约定。
 */
import copy from "@/tools/native-copy-extra.json";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

type CopyEntry = { zh?: string; en?: string };

const TABLE = copy as unknown as Record<string, CopyEntry | string>;

export function achCopy(
  key: string,
  locale: string,
  vars?: Record<string, string | number>,
): string {
  const entry = TABLE[key];
  let text: string;
  if (typeof entry === "string") text = entry;
  else if (locale === "en") text = entry?.en ?? entry?.zh ?? key;
  else text = entry?.zh ?? entry?.en ?? key;
  if (locale === "zh-TW") text = toZhTwText(text);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.split(`{{${k}}}`).join(String(v));
    }
  }
  return text;
}
