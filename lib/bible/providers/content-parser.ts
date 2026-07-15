export type RemoteChapterVerseRow = {
  verse: number;
  text: string;
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|h[1-6]|li|tr|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeContentText(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  const htmlLike = /<\/?[a-z][\s\S]*>/i.test(trimmed);
  const text = htmlLike ? stripHtml(trimmed) : trimmed;
  return decodeHtmlEntities(text).replace(/\u00a0/g, " ").trim();
}

function parseVerseToken(token: string): { start: number; end: number } | null {
  const cleaned = String(token || "").trim();
  if (!cleaned) return null;
  const range = cleaned.split("-", 2);
  const first = Number.parseInt(range[0].match(/\d+/)?.[0] ?? "", 10);
  if (!Number.isInteger(first) || first < 1) return null;
  if (range.length === 1) return { start: first, end: first };
  const last = Number.parseInt(range[1].match(/\d+/)?.[0] ?? "", 10);
  if (!Number.isInteger(last) || last < first) return { start: first, end: first };
  return { start: first, end: last };
}

function expandVerseToken(token: string): number[] {
  const parsed = parseVerseToken(token);
  if (!parsed) return [];
  const out: number[] = [];
  for (let verse = parsed.start; verse <= parsed.end; verse += 1) {
    out.push(verse);
  }
  return out;
}

function appendVerse(rows: RemoteChapterVerseRow[], verse: number, text: string): void {
  const normalizedText = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalizedText) return;
  const hit = rows.find((row) => row.verse === verse);
  if (hit) {
    if (!hit.text.includes(normalizedText)) {
      hit.text = `${hit.text} ${normalizedText}`.replace(/\s+/g, " ").trim();
    }
    return;
  }
  rows.push({ verse, text: normalizedText });
}

export function parseRemoteChapterContent(rawContent: string): RemoteChapterVerseRow[] {
  const content = normalizeContentText(rawContent);
  if (!content) return [];

  const rows: RemoteChapterVerseRow[] = [];
  const blocks = content
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<!-)(?=\b\d+(?:[a-z])?(?:-\d+(?:[a-z])?)?\s)/i))
    .map((part) => part.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const match = block.match(/^(\d+(?:[a-z])?(?:-\d+(?:[a-z])?)?)(?:\s+)(.+)$/i);
    if (!match) continue;
    const verses = expandVerseToken(match[1]);
    if (!verses.length) continue;
    const text = match[2].trim();
    for (const verse of verses) {
      appendVerse(rows, verse, text);
    }
  }

  return rows.sort((a, b) => a.verse - b.verse);
}
