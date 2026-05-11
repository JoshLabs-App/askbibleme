import { SELAH_BIBLE_FORMAT } from "@/lib/bible/translations-types";

const MAX_BOOKS = 88;
const MAX_CHAPTERS = 200;
const MAX_VERSES_PER_CHAPTER = 400;
const MAX_TOTAL_VERSES = 120_000;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** 书卷代码：大写字母/数字，如 GEN、1SA */
const BOOK_RE = /^[A-Z0-9]{2,8}$/;

/**
 * 校验 `selah-bible-v1` 上传 JSON；通过则返回 `books` 与节数。
 */
export function parseAndValidateBiblePayload(raw: unknown): {
  books: Record<string, Record<string, Record<string, string>>>;
  verseCount: number;
} {
  if (!raw || typeof raw !== "object") {
    throw new Error("JSON 须为对象。");
  }
  const o = raw as Record<string, unknown>;
  const fmt = o.format;
  if (fmt !== undefined && fmt !== SELAH_BIBLE_FORMAT) {
    throw new Error(`format 须为 "${SELAH_BIBLE_FORMAT}" 或省略。`);
  }
  const booksRaw = o.books;
  if (!booksRaw || typeof booksRaw !== "object" || Array.isArray(booksRaw)) {
    throw new Error("根级须包含对象字段 books（书卷 → 章 → 节 → 经文）。");
  }
  const books = booksRaw as Record<string, unknown>;
  const bookKeys = Object.keys(books);
  if (bookKeys.length === 0) {
    throw new Error("books 不能为空。");
  }
  if (bookKeys.length > MAX_BOOKS) {
    throw new Error(`书卷数量过多（上限 ${MAX_BOOKS}）。`);
  }

  let verseCount = 0;
  for (const bk of bookKeys) {
    if (!BOOK_RE.test(bk)) {
      throw new Error(`无效书卷代码「${bk}」（须为大写字母/数字，2～8 位）。`);
    }
    const chObj = books[bk];
    if (!chObj || typeof chObj !== "object" || Array.isArray(chObj)) {
      throw new Error(`书卷 ${bk} 下须为章对象。`);
    }
    const chMap = chObj as Record<string, unknown>;
    const chKeys = Object.keys(chMap);
    if (chKeys.length > MAX_CHAPTERS) {
      throw new Error(`书卷 ${bk} 章数过多（上限 ${MAX_CHAPTERS}）。`);
    }
    for (const ch of chKeys) {
      if (!/^\d+$/.test(ch) || Number(ch) < 1 || Number(ch) > MAX_CHAPTERS) {
        throw new Error(`书卷 ${bk} 下无效章号「${ch}」。`);
      }
      const vsObj = chMap[ch];
      if (!vsObj || typeof vsObj !== "object" || Array.isArray(vsObj)) {
        throw new Error(`${bk} ${ch} 下须为节对象。`);
      }
      const vsMap = vsObj as Record<string, unknown>;
      const vsKeys = Object.keys(vsMap);
      if (vsKeys.length > MAX_VERSES_PER_CHAPTER) {
        throw new Error(`${bk} ${ch} 节数过多（上限 ${MAX_VERSES_PER_CHAPTER}）。`);
      }
      for (const vn of vsKeys) {
        if (!/^\d+$/.test(vn) || Number(vn) < 1 || Number(vn) > MAX_VERSES_PER_CHAPTER) {
          throw new Error(`${bk} ${ch} 下无效节号「${vn}」。`);
        }
        const text = vsMap[vn];
        if (!isNonEmptyString(text)) {
          throw new Error(`${bk} ${ch}:${vn} 经文须为非空字符串。`);
        }
        verseCount++;
        if (verseCount > MAX_TOTAL_VERSES) {
          throw new Error(`总节数超过上限 ${MAX_TOTAL_VERSES}。`);
        }
      }
    }
  }

  return {
    books: books as Record<string, Record<string, Record<string, string>>>,
    verseCount,
  };
}
