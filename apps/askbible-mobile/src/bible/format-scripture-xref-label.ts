import type { AppLocale } from "../i18n/config";
import { getScriptureBookDisplayName } from "./scripture-book-display-name";
import type { ScriptureXrefTarget } from "./scripture-xref-types";

function verseRangeSuffix(verseStart: number, verseEnd: number): string {
  if (verseStart === verseEnd) return `${verseStart}`;
  return `${verseStart}–${verseEnd}`;
}

export function formatScriptureXrefLabel(target: ScriptureXrefTarget, locale: AppLocale): string {
  const name = getScriptureBookDisplayName(target.bookId, locale);
  return `${name} ${target.chapter}:${verseRangeSuffix(target.verseStart, target.verseEnd)}`;
}
