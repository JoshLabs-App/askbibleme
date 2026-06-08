import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppLocale } from "../i18n/config";
import {
  getActiveExploreFeaturedArticlesBundle,
  listExploreFeaturedArticleViews,
  type ExploreFeaturedArticle,
} from "./exploreFeaturedArticlesBundleCore";
import {
  forceRefreshExploreFeaturedArticles,
  hydrateExploreFeaturedArticlesFromDisk,
  refreshExploreFeaturedArticlesInBackground,
  subscribeExploreFeaturedArticlesBundle,
} from "./fetchExploreFeaturedArticles";

export function useExploreFeaturedArticles(locale: AppLocale): {
  articles: ExploreFeaturedArticle[];
  refresh: () => Promise<void>;
} {
  const [bundle, setBundle] = useState(getActiveExploreFeaturedArticlesBundle);

  const articles = useMemo(() => listExploreFeaturedArticleViews(bundle, locale), [bundle, locale]);

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

  return { articles, refresh };
}

export function useExploreFeaturedArticle(
  slug: string | null | undefined,
  locale: AppLocale,
): {
  article: ExploreFeaturedArticle | null;
} {
  const { articles } = useExploreFeaturedArticles(locale);
  const article = useMemo(() => {
    if (!slug) return null;
    return articles.find((item) => item.slug === slug) ?? null;
  }, [articles, slug]);
  return { article };
}
