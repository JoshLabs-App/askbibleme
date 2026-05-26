import { getLocale } from "../i18n/locale-store";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const raw = require("../../assets/content/bible_book_history_eras.json") as {
  books?: { bookId: string; bc?: number; ce?: number; approx?: boolean }[];
};

const eraByBookId = new Map<string, { bc?: number; ce?: number; approx?: boolean }>();
for (const item of raw.books || []) {
  const id = String(item.bookId || "").trim().toUpperCase();
  if (!id) continue;
  eraByBookId.set(id, item);
}

export function formatBibleBookHistoryEraCompact(bookId: string): string {
  const row = eraByBookId.get(bookId.trim().toUpperCase());
  if (!row) return "";
  const locale = getLocale();
  if (typeof row.bc === "number") {
    return locale === "en" ? `${row.bc} BC` : `前${row.bc}`;
  }
  if (typeof row.ce === "number") {
    return locale === "en" ? `${row.ce} AD` : `${row.ce}`;
  }
  return "";
}
