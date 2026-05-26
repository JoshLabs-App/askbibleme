/** 复制到剪贴板：「书卷名 章:节 经文」 */
export function formatScriptureVerseClipboard(ref: {
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
}): string {
  const body = ref.text.trim();
  return `${ref.bookName} ${ref.chapter}:${ref.verse} ${body}`.trim();
}
