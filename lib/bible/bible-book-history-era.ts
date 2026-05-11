import type { ScriptureBook } from "@/lib/bible/scripture-books";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import raw from "@/data/bible/bible_book_history_eras.json";

/** 与 `data/bible/bible_book_history_eras.json` 单条一致：bc 与 ce 二选一。 */
export type BibleBookHistoryEraBook = {
  bookId: string;
  bc?: number;
  ce?: number;
  approx?: boolean;
};

type RawRoot = {
  version?: number;
  books?: BibleBookHistoryEraBook[];
};

const root = raw as RawRoot;

/** 窄列：`前4000` 或 `57`（公元仅数字）。 */
export function formatBibleBookHistoryEraCompact(bookId: string): string {
  const row = eraByBookId.get(String(bookId || "").trim().toUpperCase());
  if (!row) return "";
  if (typeof row.bc === "number") return `前${row.bc}`;
  if (typeof row.ce === "number") return `${row.ce}`;
  return "";
}

/** 朗读 / aria。 */
export function formatBibleBookHistoryEraAriaZh(bookId: string): string {
  const row = eraByBookId.get(String(bookId || "").trim().toUpperCase());
  if (!row) return "";
  const prefix = row.approx ? "约" : "";
  if (typeof row.bc === "number") return `${prefix}公元前${row.bc}年`;
  if (typeof row.ce === "number") return `${prefix}公元${row.ce}年`;
  return "";
}

const eraByBookId = new Map<string, BibleBookHistoryEraBook>();

for (const item of root.books || []) {
  if (!item || typeof item.bookId !== "string") continue;
  const id = item.bookId.trim().toUpperCase();
  const hasBc = typeof item.bc === "number";
  const hasCe = typeof item.ce === "number";
  if (hasBc === hasCe) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[bible-book-history-era] book %s must have exactly one of bc|ce", id);
    }
    continue;
  }
  eraByBookId.set(id, item);
}

if (process.env.NODE_ENV !== "production") {
  const expected = scriptureBooks.map((b: ScriptureBook) => b.bookId);
  const missing = expected.filter((id) => !eraByBookId.has(id));
  const extra = [...eraByBookId.keys()].filter((id) => !expected.includes(id));
  if (missing.length || extra.length) {
    console.warn(
      "[bible-book-history-era] bookId mismatch with scriptureBooks. missing=%s extra=%s",
      missing.join(","),
      extra.join(","),
    );
  }
}

export function getBibleBookHistoryEraBook(bookId: string): BibleBookHistoryEraBook | undefined {
  return eraByBookId.get(String(bookId || "").trim().toUpperCase());
}

export const bibleBookHistoryEraVersion = root.version ?? 2;
