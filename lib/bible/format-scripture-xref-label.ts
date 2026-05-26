import type { AppLocale } from "@/lib/i18n/config";
import { formatVerseRefFootnote } from "@/lib/bible/format-verse-ref-footnote";
import type { VerseRef } from "@/lib/bible/verse-ref";

/** Display label for a cross-reference target (e.g. 以赛亚书 61:1–2). */
export function formatScriptureXrefLabel(ref: VerseRef, locale: AppLocale): string {
  return formatVerseRefFootnote(ref, locale) ?? `${ref.bookId} ${ref.chapter}:${ref.verseStart}`;
}
