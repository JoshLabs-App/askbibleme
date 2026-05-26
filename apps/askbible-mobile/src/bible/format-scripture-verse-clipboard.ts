/** 与 `lib/bible/format-scripture-verse-clipboard.ts` 同构 */

export function formatScriptureVerseClipboard(ref: {
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}): string {
  const body = ref.text.trim();
  return `${ref.bookName} ${ref.chapter}:${ref.verse} ${body}`.trim();
}
