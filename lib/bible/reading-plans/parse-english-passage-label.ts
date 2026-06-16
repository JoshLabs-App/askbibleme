import { ENGLISH_BOOK_ALIASES_SORTED } from "@/lib/bible/reading-plans/english-book-aliases";
import { withBundledReadingPlanChapterTotal } from "@/lib/bible/reading-plans/plan-chapter-total";
import type { ReadingPlanRange } from "@/lib/bible/reading-plans/types";
import { scriptureBooks } from "@/lib/bible/scripture-books";

function finish(range: Omit<ReadingPlanRange, "planChapterTotal">): ReadingPlanRange {
  return withBundledReadingPlanChapterTotal(range);
}

const CROSS_CHAPTER_VERSES = /^(\d+):(\d+)-(\d+):(\d+)$/;
const SAME_CHAPTER_VERSE_RANGE = /^(\d+):(\d+)-(\d+)$/;
/** e.g. `Proverbs 10:5` — single verse. */
const SINGLE_CHAPTER_VERSE = /^(\d+):(\d+)$/;
/** e.g. `Luke 16-17:10` → chapter 16 through chapter 17 verse 10 (start verse implied 1). */
const CHAPTER_THROUGH_CHAPTER_VERSE = /^(\d+)-(\d+):(\d+)$/;
const CHAPTER_RANGE = /^(\d+)-(\d+)$/;
const SINGLE_CHAPTER = /^(\d+)$/;

function matchEnglishBook(label: string): { bookId: string; rest: string } | null {
  const s = label.trim();
  const lower = s.toLowerCase();
  for (const { alias, bookId } of ENGLISH_BOOK_ALIASES_SORTED) {
    const al = alias.toLowerCase();
    if (!lower.startsWith(al)) continue;
    const next = s.charAt(al.length);
    if (next && next !== " " && next !== "\t") continue;
    const rest = s.slice(al.length).trim();
    return { bookId, rest };
  }
  return null;
}

/**
 * Parse labels like "Genesis 1", "Genesis 9-10", "Psalm 119:1-24",
 * "Genesis 1:1-3:24", "Matthew 5:1-26", "Luke 1:26-56".
 */
export function parseEnglishPassageLabel(full: string): ReadingPlanRange {
  const label = full.trim();
  const mbook = matchEnglishBook(label);
  if (!mbook) {
    throw new Error(`[reading-plan] unknown book in label: ${JSON.stringify(label)}`);
  }
  const { bookId, rest } = mbook;
  if (!rest) {
    const meta = scriptureBooks.find((b) => b.bookId === bookId);
    if (meta?.chapters === 1) {
      return finish({ bookId, startChapter: 1, endChapter: 1, label });
    }
    throw new Error(`[reading-plan] missing chapter in label: ${JSON.stringify(label)}`);
  }

  let cross = CROSS_CHAPTER_VERSES.exec(rest);
  if (cross) {
    const startChapter = Number(cross[1]);
    const startVerse = Number(cross[2]);
    const endChapter = Number(cross[3]);
    const endVerse = Number(cross[4]);
    if (![startChapter, startVerse, endChapter, endVerse].every((n) => Number.isFinite(n) && n >= 1)) {
      throw new Error(`[reading-plan] invalid cross span: ${JSON.stringify(label)}`);
    }
    return finish({ bookId, startChapter, startVerse, endChapter, endVerse, label });
  }

  cross = SAME_CHAPTER_VERSE_RANGE.exec(rest);
  if (cross) {
    const chapter = Number(cross[1]);
    const startVerse = Number(cross[2]);
    const endVerse = Number(cross[3]);
    if (![chapter, startVerse, endVerse].every((n) => Number.isFinite(n) && n >= 1) || endVerse < startVerse) {
      throw new Error(`[reading-plan] invalid same-chapter span: ${JSON.stringify(label)}`);
    }
    return finish({ bookId, startChapter: chapter, endChapter: chapter, startVerse, endVerse, label });
  }

  const singleV = SINGLE_CHAPTER_VERSE.exec(rest);
  if (singleV) {
    const chapter = Number(singleV[1]);
    const verse = Number(singleV[2]);
    if (![chapter, verse].every((n) => Number.isFinite(n) && n >= 1)) {
      throw new Error(`[reading-plan] invalid single verse: ${JSON.stringify(label)}`);
    }
    return finish({
      bookId,
      startChapter: chapter,
      endChapter: chapter,
      startVerse: verse,
      endVerse: verse,
      label,
    });
  }

  const ctv = CHAPTER_THROUGH_CHAPTER_VERSE.exec(rest);
  if (ctv) {
    const startChapter = Number(ctv[1]);
    const endChapter = Number(ctv[2]);
    const endVerse = Number(ctv[3]);
    if (
      ![startChapter, endChapter, endVerse].every((n) => Number.isFinite(n) && n >= 1) ||
      endChapter < startChapter
    ) {
      throw new Error(`[reading-plan] invalid chapter-through span: ${JSON.stringify(label)}`);
    }
    return finish({ bookId, startChapter, startVerse: 1, endChapter, endVerse, label });
  }

  const cr = CHAPTER_RANGE.exec(rest);
  if (cr) {
    const startChapter = Number(cr[1]);
    const endChapter = Number(cr[2]);
    if (![startChapter, endChapter].every((n) => Number.isFinite(n) && n >= 1) || endChapter < startChapter) {
      throw new Error(`[reading-plan] invalid chapter range: ${JSON.stringify(label)}`);
    }
    return finish({ bookId, startChapter, endChapter, label });
  }

  const sc = SINGLE_CHAPTER.exec(rest);
  if (sc) {
    const chapter = Number(sc[1]);
    if (!Number.isFinite(chapter) || chapter < 1) {
      throw new Error(`[reading-plan] invalid chapter: ${JSON.stringify(label)}`);
    }
    return finish({ bookId, startChapter: chapter, endChapter: chapter, label });
  }

  throw new Error(`[reading-plan] unparseable tail ${JSON.stringify(rest)} in ${JSON.stringify(label)}`);
}
