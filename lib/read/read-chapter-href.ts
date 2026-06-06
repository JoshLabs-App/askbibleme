export function readChapterHref(
  bookId: string,
  chapter: number,
  opts?: { planFlow?: boolean },
): string {
  const base = `/read/${encodeURIComponent(bookId)}/${chapter}`;
  return opts?.planFlow ? `${base}?planFlow=1` : base;
}
