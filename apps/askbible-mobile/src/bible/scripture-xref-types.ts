export type ScriptureXrefTarget = {
  bookId: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  priority: number;
};

export type ScriptureVerseXrefs = {
  verse: number;
  incoming: ScriptureXrefTarget[];
  outgoing: ScriptureXrefTarget[];
};
