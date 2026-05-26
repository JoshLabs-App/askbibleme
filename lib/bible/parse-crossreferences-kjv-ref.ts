import { bookIdFromKjvAbbr } from "@/lib/bible/crossreferences-kjv-book-map";

const REF_PATTERN = /^\s*(.+?)\s+(\d+):([\d,\s\-]+)\s*$/;

export type ParsedKjvXrefTarget = {
  bookId: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
};

/** Parse `Isa 61:1-2` or `1 John 1:1` from CrossReferences-org TSV. */
export function parseKjvCrossreferenceToken(refStr: string): ParsedKjvXrefTarget | null {
  const raw = String(refStr || "").trim();
  if (!raw) return null;
  const m = REF_PATTERN.exec(raw);
  if (!m) return null;
  const bookId = bookIdFromKjvAbbr(m[1]!.trim());
  if (!bookId) return null;
  const chapter = Number(m[2]);
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  const versesPart = m[3]!.trim();
  const firstSegment = versesPart.split(",")[0]?.trim() ?? "";
  const rangeMatch = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(firstSegment);
  if (!rangeMatch) return null;
  const verseStart = Number(rangeMatch[1]);
  const verseEnd = rangeMatch[2] != null ? Number(rangeMatch[2]) : verseStart;
  if (!Number.isInteger(verseStart) || verseStart < 1) return null;
  if (!Number.isInteger(verseEnd) || verseEnd < verseStart) return null;
  return { bookId, chapter, verseStart, verseEnd };
}

/** Expand `33:6,9` or `22-24` into discrete target rows (one row per verseStart). */
export function expandKjvCrossreferenceTargets(refStr: string): ParsedKjvXrefTarget[] {
  const raw = String(refStr || "").trim();
  if (!raw) return [];
  const m = REF_PATTERN.exec(raw);
  if (!m) return [];
  const bookId = bookIdFromKjvAbbr(m[1]!.trim());
  if (!bookId) return [];
  const chapter = Number(m[2]);
  if (!Number.isInteger(chapter) || chapter < 1) return [];

  const out: ParsedKjvXrefTarget[] = [];
  for (const part of m[3]!.split(",")) {
    const seg = part.trim();
    const rm = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(seg);
    if (!rm) continue;
    const verseStart = Number(rm[1]);
    const verseEnd = rm[2] != null ? Number(rm[2]) : verseStart;
    if (!Number.isInteger(verseStart) || verseStart < 1) continue;
    if (!Number.isInteger(verseEnd) || verseEnd < verseStart) continue;
    out.push({ bookId, chapter, verseStart, verseEnd });
  }
  return out;
}
