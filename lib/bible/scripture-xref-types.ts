import type { VerseRef } from "@/lib/bible/verse-ref";

/** One curated cross-reference edge (outgoing from a source verse). */
export type ScriptureXrefTarget = VerseRef & {
  priority: number;
};

/** Per-verse xref bundle for the read chapter UI. */
export type ScriptureVerseXrefs = {
  verse: number;
  incoming: ScriptureXrefTarget[];
  outgoing: ScriptureXrefTarget[];
};

export type ScriptureChapterXrefs = {
  bookId: string;
  chapter: number;
  byVerse: Map<number, ScriptureVerseXrefs>;
};
