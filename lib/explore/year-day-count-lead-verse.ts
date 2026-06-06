/** 页顶诗篇 90:12：按语气拆成 2～3 行，便于主展示 */
export function splitYearDayCountLeadVerseLines(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];

  const zhParts = text.split(/(?=好叫)/).map((s) => s.trim()).filter(Boolean);
  if (zhParts.length === 2) return zhParts;

  const enParts = text.split(/(?=that we may\b)/i).map((s) => s.trim()).filter(Boolean);
  if (enParts.length === 2) return enParts;

  const punctParts = text.split(/(?<=[，；。!?])\s*/).map((s) => s.trim()).filter(Boolean);
  if (punctParts.length >= 2) return punctParts;

  return [text];
}
