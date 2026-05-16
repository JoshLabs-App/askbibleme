import { scriptureBooks } from "@/lib/bible/scripture-books";

/** 先匹配较长书名，避免「约翰」误命中「约翰一书」。 */
const BOOKS_BY_NAME_LEN = [...scriptureBooks].sort((a, b) => b.bookName.length - a.bookName.length);

/**
 * 将和合本风格中文书卷名（如「马太福音」）解析为 Selah `bookId`（如 MAT）。
 */
export function chineseBookNameToBookId(name: string): string | null {
  const n = String(name ?? "").trim();
  if (!n) return null;
  for (const b of BOOKS_BY_NAME_LEN) {
    if (b.bookName === n) return b.bookId;
  }
  return null;
}
