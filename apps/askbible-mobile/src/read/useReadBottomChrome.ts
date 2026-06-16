import { usePathname, useRouter } from "expo-router";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  getReadChapterBottomChromeApi,
  subscribeReadChapterBottomChromeApi,
  type ReadChapterBottomChromeApi,
} from "./read-chapter-chrome-inset";
import { readRouteUsesBottomActionChrome } from "./read-route-chrome";

/** 章页 API 优先；圣经首页与其余读经子页用默认快捷操作（目录→/read/catalog，下一章禁用） */
export function useReadBottomChrome(): ReadChapterBottomChromeApi | null {
  const pathname = usePathname();
  const router = useRouter();
  const chapterChrome = useSyncExternalStore(
    subscribeReadChapterBottomChromeApi,
    getReadChapterBottomChromeApi,
    getReadChapterBottomChromeApi,
  );

  const openCatalog = useCallback(() => {
    router.push("/read/catalog");
  }, [router]);

  return useMemo(() => {
    if (chapterChrome) return chapterChrome;
    if (!readRouteUsesBottomActionChrome(pathname)) return null;
    return {
      openCatalog,
      goNext: () => {},
      hasNext: false,
    };
  }, [chapterChrome, openCatalog, pathname]);
}
