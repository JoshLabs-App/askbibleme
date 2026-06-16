import { loadChapterFromTranslation } from "@/lib/bible/load-chapter-from-default-translation";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { filterEternityScriptures } from "@/lib/explore/years-days-eternity-blocks";
import { YEARS_DAYS_ETERNITY_EN } from "@/lib/explore/years-days-eternity-content-en";
import { YEARS_DAYS_ETERNITY_ZH } from "@/lib/explore/years-days-eternity-content";
import type { AppLocale } from "@/lib/i18n/config";

type RefVersePart = { chapter: number; start: number; end: number };

function parseZhRefParts(ref: string): { bookId: string; parts: RefVersePart[] } | null {
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

function localizeRefLabel(rawRef: string, locale: AppLocale): string {
  if (locale !== "en") return rawRef;
  const parsed = parseZhRefParts(rawRef);
  if (!parsed) return rawRef;
  const book = getScriptureBookDisplayName(parsed.bookId, locale);
  const uniqueChapters = Array.from(new Set(parsed.parts.map((p) => p.chapter)));
  if (uniqueChapters.length === 1) {
    const chapter = uniqueChapters[0];
    const spec = parsed.parts.map((p) => formatRefPart(p)).join(",");
    return `${book} ${chapter}:${spec}`;
  }
  const spec = parsed.parts.map((p) => `${p.chapter}:${formatRefPart(p)}`).join(", ");
  return `${book} ${spec}`;
}

export async function loadYearsDaysEternityEnScriptureOverrides(locale: AppLocale) {
  if (locale !== "en") {
    return { enScriptureBodyByRef: undefined, enRefLabelByRaw: undefined };
  }

  const cwd = process.cwd();
  const fullScriptureSections = YEARS_DAYS_ETERNITY_EN.sections.map((section) => {
    const source = YEARS_DAYS_ETERNITY_ZH.sections.find((s) => s.id === section.id);
    return source ? { ...section, blocks: source.blocks } : section;
  });

  const refs = Array.from(
    new Set(fullScriptureSections.flatMap((section) => filterEternityScriptures(section.blocks)).map((b) => b.ref)),
  );

  const chapterCache = new Map<string, Awaited<ReturnType<typeof loadChapterFromTranslation>>>();
  const enScriptureBodyByRef: Record<string, string> = {};

  for (const ref of refs) {
    const parsed = parseZhRefParts(ref);
    if (!parsed) continue;
    const lines: string[] = [];
    for (const part of parsed.parts) {
      const chapterKey = `${parsed.bookId}:${part.chapter}`;
      if (!chapterCache.has(chapterKey)) {
        const loaded = await loadChapterFromTranslation(cwd, parsed.bookId, part.chapter, "web-en");
        chapterCache.set(chapterKey, loaded);
      }
      const loaded = chapterCache.get(chapterKey);
      if (!loaded) continue;
      for (const verse of loaded.verses) {
        if (verse.verse >= part.start && verse.verse <= part.end) {
          lines.push(verse.text);
        }
      }
    }
    if (lines.length > 0) {
      enScriptureBodyByRef[ref] = lines.map((l) => l.trim()).filter(Boolean).join(" ");
    }
  }

  const enRefLabelByRaw = Object.fromEntries(refs.map((ref) => [ref, localizeRefLabel(ref, locale)]));
  return { enScriptureBodyByRef, enRefLabelByRaw };
}
