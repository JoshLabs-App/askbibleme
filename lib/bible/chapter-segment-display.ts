import type { AppLocale } from "@/lib/i18n/config";
import type { ChapterSegment } from "@/lib/bible/load-chapter-segments";

function isHanText(text: string): boolean {
  return /[\u3400-\u9FFF]/.test(text);
}

/** 分段标题按 App 语言显示；英文界面不回落中文 T1 文案。 */
export function resolveChapterSegmentHeadingText(
  row: ChapterSegment,
  locale: AppLocale,
  toZhTw?: (text: string) => string,
): string {
  const en = String(row.title || "").trim();
  const zh = String(row.titleZh || row.title || "").trim();

  let raw = "";
  if (locale === "en") {
    if (en && !isHanText(en)) raw = en;
  } else {
    raw = zh || en;
  }

  if (!raw) return "";
  if (locale === "zh-TW" && toZhTw) return toZhTw(raw).trim();
  return raw.trim();
}
