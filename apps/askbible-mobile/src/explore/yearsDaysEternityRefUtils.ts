import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { scriptureBooks } from "../bible/scripture-books";
import type { AppLocale } from "../i18n/config";
import { localizeZhText } from "../i18n/site-copy";

export type RefVersePart = { chapter: number; start: number; end: number };

export function parseZhRefParts(ref: string): { bookId: string; parts: RefVersePart[] } | null {
  const normalized = ref.replace(/\s+/g, " ").trim();
  const m = normalized.match(/^(.+?)\s+(\d+):(.+)$/);
  if (!m) return null;
  const bookName = m[1]?.trim();
  const baseChapter = Number(m[2]);
  const tail = m[3]?.trim() ?? "";
  if (!bookName || !Number.isInteger(baseChapter) || baseChapter < 1 || !tail) return null;
  const bookId = scriptureBooks.find((b) => b.bookName === bookName)?.bookId;
  if (!bookId) return null;
  const parts: RefVersePart[] = [];
  const segments = tail.split(",").map((x) => x.trim()).filter(Boolean);
  for (const seg of segments) {
    let chapter = baseChapter;
    let verseSpec = seg;
    if (seg.includes(":")) {
      const cm = seg.match(/^(\d+):(.+)$/);
      if (!cm) continue;
      chapter = Number(cm[1]);
      verseSpec = cm[2]?.trim() ?? "";
    }
    if (!Number.isInteger(chapter) || chapter < 1 || !verseSpec) continue;
    const rm = verseSpec.match(/^(\d+)-(\d+)$/);
    if (rm) {
      const start = Number(rm[1]);
      const end = Number(rm[2]);
      if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
        parts.push({ chapter, start, end });
      }
      continue;
    }
    const single = Number(verseSpec);
    if (Number.isInteger(single) && single >= 1) {
      parts.push({ chapter, start: single, end: single });
    }
  }
  if (!parts.length) return null;
  return { bookId, parts };
}

function formatRefPart(part: RefVersePart): string {
  return part.start === part.end ? `${part.start}` : `${part.start}-${part.end}`;
}

export function localizeRefLabel(rawRef: string, locale: AppLocale): string {
  if (locale === "en") {
    const parsed = parseZhRefParts(rawRef);
    if (!parsed) return rawRef;
    const book = getScriptureBookDisplayName(parsed.bookId, locale);
    if (!book) return rawRef;
    const uniqueChapters = Array.from(new Set(parsed.parts.map((p) => p.chapter)));
    if (uniqueChapters.length === 1) {
      const chapter = uniqueChapters[0];
      const spec = parsed.parts.map((p) => formatRefPart(p)).join(",");
      return `${book} ${chapter}:${spec}`;
    }
    const spec = parsed.parts.map((p) => `${p.chapter}:${formatRefPart(p)}`).join(", ");
    return `${book} ${spec}`;
  }
  return localizeZhText(locale, rawRef);
}

export function stripSectionTitlePrefix(title: string): string {
  return title
    .replace(/^\s*\d+\s*[\.\)、]\s*/, "")
    .replace(/^\s*[一二三四五六七八九十]+\s*[、.]\s*/, "")
    .trim();
}
