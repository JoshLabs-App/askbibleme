import fs from "node:fs";
import path from "node:path";
import { scriptureBookNotes } from "@/lib/bible/scripture-book-notes";
import { scriptureBooks } from "@/lib/bible/scripture-books";

const REL_PATH = path.join("data", "bible", "scripture_canon_catalog.json");

export type ScriptureCanonCatalogBook = {
  bookId: string;
  bookNumber: number;
  bookName: string;
  divine: string;
  summary: string;
};

export type ScriptureCanonCatalogSection = {
  sectionId: string;
  order: number;
  title: string;
  taglines: string[];
  books: ScriptureCanonCatalogBook[];
};

export type ScriptureCanonCatalogRoot = {
  version: number;
  sections: ScriptureCanonCatalogSection[];
};

type RawSection = {
  sectionId?: string;
  order?: number;
  title?: string;
  taglines?: string[];
  bookIds?: string[];
};

type RawRoot = {
  version?: number;
  sections?: RawSection[];
};

const booksById = new Map(scriptureBooks.map((b) => [b.bookId, b]));
const notesByBookId = new Map(scriptureBookNotes.map((n) => [n.bookId, n]));

function assertCanonCompleteness(allIds: string[]) {
  const expected = scriptureBooks.map((b) => b.bookId);
  const seen = new Set<string>();
  const dupes = allIds.filter((id) => {
    if (seen.has(id)) return true;
    seen.add(id);
    return false;
  });
  if (dupes.length) {
    throw new Error(`[scripture-canon-catalog] duplicate bookIds: ${dupes.join(", ")}`);
  }
  const missing = expected.filter((id) => !seen.has(id));
  const extra = allIds.filter((id) => !booksById.has(id));
  if (missing.length || extra.length || allIds.length !== 66) {
    throw new Error(
      `[scripture-canon-catalog] book coverage mismatch: missing=${missing.join(",")} extra=${extra.join(",")} count=${allIds.length}`,
    );
  }
}

function normalizeTaglines(raw: string[] | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => String(t || "").trim()).filter(Boolean);
}

function normalizeSections(raw: RawSection[] | undefined): ScriptureCanonCatalogSection[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("[scripture-canon-catalog] sections must be a non-empty array");
  }

  const sections: ScriptureCanonCatalogSection[] = raw.map((item, idx) => {
    const sectionId = String(item.sectionId || "").trim() || `canon-section-${idx + 1}`;
    const order = typeof item.order === "number" && item.order > 0 ? item.order : idx + 1;
    const title = String(item.title || "").trim() || sectionId;
    const taglines = normalizeTaglines(item.taglines);
    const bookIds = Array.isArray(item.bookIds)
      ? item.bookIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];

    const books: ScriptureCanonCatalogBook[] = bookIds.map((bookId) => {
      const book = booksById.get(bookId);
      if (!book) {
        throw new Error(`[scripture-canon-catalog] unknown bookId "${bookId}" in section "${sectionId}"`);
      }
      const note = notesByBookId.get(bookId);
      if (!note) {
        throw new Error(`[scripture-canon-catalog] missing scriptureBookNotes for "${bookId}"`);
      }
      const divine = String(note.spiritualFrame?.divine || "").trim();
      if (!divine) {
        throw new Error(`[scripture-canon-catalog] missing spiritualFrame.divine for "${bookId}"`);
      }
      return {
        bookId: book.bookId,
        bookNumber: book.bookNumber,
        bookName: book.bookName,
        divine,
        summary: note.summary,
      };
    });

    return { sectionId, order, title, taglines, books };
  });

  const allIds = sections.flatMap((s) => s.books.map((b) => b.bookId));
  assertCanonCompleteness(allIds);

  return sections.sort((a, b) => a.order - b.order);
}

function parseRoot(parsed: RawRoot | null | undefined): ScriptureCanonCatalogRoot {
  if (!parsed?.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error("[scripture-canon-catalog] invalid root");
  }
  const version = typeof parsed.version === "number" && parsed.version >= 1 ? parsed.version : 1;
  return {
    version,
    sections: normalizeSections(parsed.sections),
  };
}

/** 读 `data/bible/scripture_canon_catalog.json` 并与 66 卷 / 书卷注释对齐（服务端）。 */
export function readScriptureCanonCatalog(): ScriptureCanonCatalogRoot {
  const filePath = path.join(process.cwd(), REL_PATH);
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as RawRoot;
  return parseRoot(raw);
}
