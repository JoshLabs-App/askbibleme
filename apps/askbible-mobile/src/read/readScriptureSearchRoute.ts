/** 与探索文章路由相同：Android 上显式 pathname，避免栈内字符串 push 偶发异常 */
export function readScriptureSearchRoute(opts?: { bookId?: string; chapter?: number }) {
  const bookId = String(opts?.bookId ?? "").trim();
  const chapter = opts?.chapter;
  if (bookId && Number.isInteger(chapter) && (chapter as number) >= 1) {
    return {
      pathname: "/read/search" as const,
      params: {
        bookId,
        chapter: String(chapter),
      },
    };
  }
  return { pathname: "/read/search" as const };
}
