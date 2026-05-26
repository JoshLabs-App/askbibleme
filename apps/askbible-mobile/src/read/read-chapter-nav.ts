import type { Router } from "expo-router";

export type ReadChapterNavDirection = "forward" | "back";

const CHAPTER_PATH = "/read/[bookId]/[chapter]" as const;

export function readChapterRouteParams(target: { bookId: string; chapter: number }) {
  return {
    pathname: CHAPTER_PATH,
    params: {
      bookId: target.bookId,
      chapter: String(target.chapter),
    },
  };
}

export function chapterNavDirection(
  from: { bookId: string; chapter: number },
  to: { bookId: string; chapter: number },
): ReadChapterNavDirection {
  if (from.bookId !== to.bookId) return "forward";
  return to.chapter < from.chapter ? "back" : "forward";
}

/**
 * 相邻章导航。
 * - 下一章 push（系统右进）
 * - 上一章 back（系统左出）
 */
export function navigateReadChapter(
  router: Pick<Router, "push" | "back" | "canGoBack" | "replace" | "setParams">,
  target: { bookId: string; chapter: number },
  direction: ReadChapterNavDirection,
) {
  if (direction === "back" && router.canGoBack()) {
    router.back();
    return;
  }
  if (direction === "forward") {
    router.push(readChapterRouteParams(target));
    return;
  }
  router.replace(readChapterRouteParams(target));
}

/** 目录跳章：统一使用 replace，避免平台行为分叉 */
export function jumpReadChapter(
  router: Pick<Router, "replace" | "setParams">,
  target: { bookId: string; chapter: number },
) {
  router.replace(readChapterRouteParams(target));
}
