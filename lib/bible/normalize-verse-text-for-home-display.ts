/**
 * 首页轮播 / 祷告池展示用：解码常见 HTML 实体，并去掉正文里的尖括号标记（如 BBE 的 `<A Song of Ascents>`），
 * 避免画面上出现 `&lt;` `&gt;` 或整段 XML 式标题。
 */
function decodeHtmlEntitiesLite(s: string): string {
  let t = s
    .replace(/&#x([0-9a-f]{1,6});/gi, (m, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    })
    .replace(/&#(\d{1,7});/g, (m, dec: string) => {
      const code = Number(dec);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    });
  t = t.replace(/&nbsp;/gi, " ");
  t = t.replace(/&amp;/gi, "&");
  t = t.replace(/&lt;/gi, "<");
  t = t.replace(/&gt;/gi, ">");
  t = t.replace(/&quot;/gi, '"');
  t = t.replace(/&apos;/gi, "'");
  t = t.replace(/&#0?39;/g, "'");
  return t;
}

export function normalizeVerseTextForHomeDisplay(text: string): string {
  const raw = text.trim();
  if (!raw) return "";
  const decoded = decodeHtmlEntitiesLite(raw);
  const noTags = decoded.replace(/<[^>]{0,500}?>/g, " ");
  return noTags.replace(/\s{2,}/g, " ").trim();
}
