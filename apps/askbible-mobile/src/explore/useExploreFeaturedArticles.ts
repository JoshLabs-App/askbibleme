import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppLocale } from "../i18n/config";
import {
  getExploreFeaturedArticleView,
  listExploreFeaturedArticleTileViews,
  type ExploreFeaturedArticle,
} from "./exploreFeaturedArticlesBundleCore";
import {
  forceRefreshExploreFeaturedArticles,
  getActiveExploreFeaturedArticlesBundle,
  hydrateExploreFeaturedArticlesFromDisk,
  refreshExploreFeaturedArticlesInBackground,
  subscribeExploreFeaturedArticlesBundle,
} from "./fetchExploreFeaturedArticles";

function useExploreFeaturedArticlesBundle() {
  const [bundle, setBundle] = useState(() => getActiveExploreFeaturedArticlesBundle());

  useEffect(() => {
    let cancelled = false;
    void hydrateExploreFeaturedArticlesFromDisk().then((next) => {
      if (!cancelled) setBundle(next);
    });
    const unsubscribe = subscribeExploreFeaturedArticlesBundle((next) => {
      if (!cancelled) setBundle(next);
    });
    refreshExploreFeaturedArticlesInBackground();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await forceRefreshExploreFeaturedArticles();
    setBundle(next);
  }, []);

  return { bundle, refresh };
}

export function useExploreFeaturedArticles(locale: AppLocale): {
  articles: ExploreFeaturedArticle[];
  refresh: () => Promise<void>;
} {
  const { bundle, refresh } = useExploreFeaturedArticlesBundle();
  const articles = useMemo(() => listExploreFeaturedArticleTileViews(bundle, locale), [bundle, locale]);
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
    return getExploreFeaturedArticleView(bundle, slug, locale);
  }, [bundle, slug, locale]);
  return { article };
}
