import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { AppLocale } from "../i18n/config";
import {
  listExploreFeaturedArticleTileViews,
  resolveExploreFeaturedArticleView,
  type ExploreFeaturedArticle,
} from "./exploreFeaturedArticlesBundleCore";
import {
  forceRefreshExploreFeaturedArticles,
  getActiveExploreFeaturedArticlesBundle,
  subscribeExploreFeaturedArticlesBundle,
} from "./fetchExploreFeaturedArticles";
import { refreshExploreContentWhenFocused } from "./refreshExploreContent";

/** Explore Tab 聚焦时再拉线上内容，避免冷启动占用网络。 */
export function refreshExploreFeaturedArticlesWhenFocused(): void {
  refreshExploreContentWhenFocused();
}

function useExploreFeaturedArticlesBundle() {
  const bundle = useSyncExternalStore(
    subscribeExploreFeaturedArticlesBundle,
    getActiveExploreFeaturedArticlesBundle,
    getActiveExploreFeaturedArticlesBundle,
  );

  const refresh = useCallback(async () => {
    return forceRefreshExploreFeaturedArticles();
  }, []);

  return { bundle, refresh };
}

export function useExploreFeaturedArticles(locale: AppLocale): {
  articles: ExploreFeaturedArticle[];
  refresh: () => ReturnType<typeof forceRefreshExploreFeaturedArticles>;
} {
  const { bundle, refresh } = useExploreFeaturedArticlesBundle();
  const articles = useMemo(
    () => listExploreFeaturedArticleTileViews(bundle, locale),
    [bundle, locale],
  );
  return { articles, refresh };
}

export function useExploreFeaturedArticle(
  slug: string | null | undefined,
  locale: AppLocale,
): {
  article: ExploreFeaturedArticle | null;
} {
  const { bundle } = useExploreFeaturedArticlesBundle();
  const article = useMemo(() => {
    if (!slug) return null;
    return resolveExploreFeaturedArticleView(bundle, slug, locale);
  }, [bundle, slug, locale]);
  return { article };
}
