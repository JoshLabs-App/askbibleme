import type { VerseRef } from "@/lib/bible/verse-ref";

export function parseVerseRefFromUnknown(v: unknown): VerseRef | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const bid = typeof o.bookId === "string" ? o.bookId.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{2,8}$/.test(bid)) return null;
  const chapter = typeof o.chapter === "number" && Number.isInteger(o.chapter) && o.chapter >= 1 ? o.chapter : NaN;
  const vs = typeof o.verseStart === "number" && Number.isInteger(o.verseStart) && o.verseStart >= 1 ? o.verseStart : NaN;
  const ve = typeof o.verseEnd === "number" && Number.isInteger(o.verseEnd) && o.verseEnd >= 1 ? o.verseEnd : NaN;
  if (!Number.isFinite(chapter) || !Number.isFinite(vs) || !Number.isFinite(ve) || ve < vs) return null;
  const translationId =
    typeof o.translationId === "string" && o.translationId.trim() ? o.translationId.trim() : undefined;
  return { bookId: bid, chapter, verseStart: vs, verseEnd: ve, translationId };
}
