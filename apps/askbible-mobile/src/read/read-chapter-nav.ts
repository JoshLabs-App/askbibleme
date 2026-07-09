import type { Router } from "expo-router";

export type ReadChapterNavDirection = "forward" | "back";

export type NavRoute = { params?: unknown };
export type NavState = { routes?: ReadonlyArray<NavRoute>; index?: number };

const CHAPTER_PATH = "/read/[bookId]/[chapter]" as const;

function paramString(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

/** 导航栈上一屏是否就是目标章（否则 back 会落到首页等非相邻章路由）。 */
export function readChapterTargetMatchesRoute(
  route: NavRoute | undefined,
  target: { bookId: string; chapter: number },
): boolean {
  if (!route?.params || typeof route.params !== "object") return false;
  const params = route.params as Record<string, unknown>;
  const bookId = paramString(params.bookId).toUpperCase();
  const chapter = Number(paramString(params.chapter));
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) return false;
  return (
    bookId === paramString(target.bookId).toUpperCase() && chapter === Number(target.chapter)
  );
}

export function canPopToReadChapterTarget(
  getNavigationState: (() => NavState | undefined) | undefined,
  target: { bookId: string; chapter: number },
): boolean {
  const state = getNavigationState?.();
  if (!state?.routes?.length || state.index == null || state.index < 1) return false;
  return readChapterTargetMatchesRoute(state.routes[state.index - 1], target);
}

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
 * - 上一章：栈顶前一屏是目标章时 back（系统左出），否则 replace
 */
export function navigateReadChapter(
  router: Pick<Router, "push" | "back" | "canGoBack" | "replace" | "setParams">,
  target: { bookId: string; chapter: number },
  direction: ReadChapterNavDirection,
  opts?: { getNavigationState?: () => NavState | undefined },
) {
  if (
    direction === "back" &&
    router.canGoBack() &&
    canPopToReadChapterTarget(opts?.getNavigationState, target)
  ) {
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
