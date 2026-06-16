import type { FigureScriptureRef } from "./types";

export type FigureParsedRef = {
  bookId: string;
  chapter: number;
  verseList: number[];
  verseLabel: string;
};

export function verseListFromFigureRef(ref: FigureScriptureRef): number[] {
  const end = ref.verseEnd ?? ref.verseStart;
  const values: number[] = [];
  for (let v = ref.verseStart; v <= end; v += 1) values.push(v);
  return values;
}

export function figureRefKey(ref: FigureScriptureRef): string {
  const end = ref.verseEnd ?? ref.verseStart;
  if (end === ref.verseStart) {
    return `${ref.bookId}:${ref.chapter}:${ref.verseStart}`;
  }
  return `${ref.bookId}:${ref.chapter}:${ref.verseStart}-${end}`;
}

export function figureRefToParsed(ref: FigureScriptureRef): FigureParsedRef {
  const verseList = verseListFromFigureRef(ref);
  const end = ref.verseEnd ?? ref.verseStart;
  const verseLabel = end === ref.verseStart ? String(ref.verseStart) : `${ref.verseStart}-${end}`;
  return {
    bookId: ref.bookId,
    chapter: ref.chapter,
    verseList,
    verseLabel,
  };
}

export function formatFigureRefCitation(ref: FigureScriptureRef, bookName: string): string {
  const end = ref.verseEnd ?? ref.verseStart;
  const verseLabel = end === ref.verseStart ? String(ref.verseStart) : `${ref.verseStart}-${end}`;
  return `${bookName} ${ref.chapter}:${verseLabel}`;
}

export function collectFigureRefKeys(
  refs: FigureScriptureRef[],
  subGroups?: { refs: FigureScriptureRef[] }[],
): string[] {
  const keys: string[] = [];
  for (const ref of refs) keys.push(figureRefKey(ref));
  if (subGroups) {
    for (const sub of subGroups) {
      for (const ref of sub.refs) keys.push(figureRefKey(ref));
    }
  }
  return keys;
}
