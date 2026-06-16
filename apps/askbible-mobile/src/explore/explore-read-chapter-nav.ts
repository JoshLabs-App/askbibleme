import type { Href } from "expo-router";
import { usePathname, useRouter, useSegments, type Router } from "expo-router";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef } from "react";

export const EXPLORE_READ_RETURN_PARAM = "exploreReturn";
export const EXPLORE_YEAR_DAY_COUNT_PATH = "/explore/year-day-count";

let pendingExploreReadReturnPath: string | null = null;

function stripExploreReturnSuffix(path: string): string {
  return path.replace(/\/index$/, "");
}

export function normalizeExploreReturnPath(pathname: string): string | null {
  let trimmed = pathname.trim().replace(/\/$/, "") || "/";
  if (!trimmed.startsWith("/")) trimmed = `/${trimmed}`;
  trimmed = trimmed.replace(/^\/?\(tabs\)\//, "/");
  trimmed = stripExploreReturnSuffix(trimmed);
  if (/^\/explore(\/|$)/.test(trimmed)) return trimmed;
  return null;
}

function buildExploreReturnPathFromSegments(segments: string[]): string | null {
  const filtered = segments.filter((segment) => segment && !segment.startsWith("("));
  const exploreIndex = filtered.indexOf("explore");
  if (exploreIndex < 0) return null;
  const tail = filtered.slice(exploreIndex);
  if (tail[0] !== "explore") return null;
  if (tail.length === 1) return "/explore";
  return stripExploreReturnSuffix(`/${tail.join("/")}`);
}

/** 当前探索栈路径，供跳读经章时写入返回目标。 */
export function useExploreReadReturnPath(): string | null {
  const pathname = usePathname();
  const segments = useSegments();
  return normalizeExploreReturnPath(pathname) ?? buildExploreReturnPathFromSegments(segments);
}

export function parseExploreReadReturnParam(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  try {
    return normalizeExploreReturnPath(decodeURIComponent(value));
  } catch {
    return normalizeExploreReturnPath(value);
  }
}

export function resolveExploreReadReturnParam(raw: string | string[] | undefined): string | null {
  const fromParam = parseExploreReadReturnParam(raw);
  if (fromParam) {
    pendingExploreReadReturnPath = null;
    return fromParam;
  }
  return pendingExploreReadReturnPath;
}

export function clearPendingExploreReadReturnPath(): void {
  pendingExploreReadReturnPath = null;
}

export function pushExploreReadChapter(
  router: Pick<Router, "push">,
  target: ExploreReadChapterTarget,
  exploreReturn: string | null,
) {
  const normalizedReturn = exploreReturn
    ? normalizeExploreReturnPath(exploreReturn) ?? exploreReturn
    : null;

  if (normalizedReturn) {
    pendingExploreReadReturnPath = normalizedReturn;
  }

  router.push({
    pathname: "/read/[bookId]/[chapter]",
    params: {
      bookId: target.bookId,
      chapter: String(target.chapter),
      ...(target.verse != null ? { verse: String(target.verse) } : {}),
      ...(normalizedReturn
        ? { [EXPLORE_READ_RETURN_PARAM]: encodeURIComponent(normalizedReturn) }
        : {}),
    },
  });
}

export type ExploreReadChapterTarget = {
  bookId: string;
  chapter: number;
  verse?: number | string;
};

type ExploreReadReturnRouter = Pick<Router, "navigate" | "push" | "back" | "canGoBack">;

export function returnFromExploreReadChapter(
  router: ExploreReadReturnRouter,
  exploreReturn: string,
) {
  clearPendingExploreReadReturnPath();
  const normalized = normalizeExploreReturnPath(exploreReturn) ?? exploreReturn;
  const goExplore = () => {
    if (typeof router.navigate === "function") {
      router.navigate(normalized as Href);
      return;
    }
    router.push(normalized as Href);
  };

  // 先弹出读经章，避免探索页多次跳入后栈里叠多个章页，返回时落到上一章。
  if (typeof router.canGoBack === "function" && router.canGoBack()) {
    router.back();
    queueMicrotask(goExplore);
    return;
  }
  goExplore();
}

/** 章页返回：拦截系统左滑 / 硬件返回，回到探索来源页。 */
export function useReadChapterExploreReturnHandler(exploreReturn: string | null) {
  const router = useRouter();
  const navigation = useNavigation();
  const returningRef = useRef(false);

  const returnToExplore = useCallback(() => {
    if (!exploreReturn || returningRef.current) return false;
    returningRef.current = true;
    returnFromExploreReadChapter(router, exploreReturn);
    return true;
  }, [exploreReturn, router]);

  // 同一章（如创世记 5 章不同人名）会复用章页实例；返回后再次进入须允许再次跳回探索页。
  useFocusEffect(
    useCallback(() => {
      returningRef.current = false;
    }, []),
  );

  useEffect(() => {
    if (!exploreReturn) return;
    const unsub = navigation.addListener("beforeRemove", (e) => {
      if (returningRef.current) return;
      const actionType = e.data.action.type;
      if (actionType !== "POP" && actionType !== "GO_BACK") return;
      e.preventDefault();
      returnToExplore();
    });
    return unsub;
  }, [exploreReturn, navigation, returnToExplore]);

  useEffect(() => {
    return () => {
      if (returningRef.current) {
        clearPendingExploreReadReturnPath();
      }
    };
  }, []);

  return returnToExplore;
}
