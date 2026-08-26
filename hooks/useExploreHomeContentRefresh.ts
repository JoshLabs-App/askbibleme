"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { exploreFeaturedArticleViewsFromBundle } from "@/lib/explore/explore-featured-articles-from-bundle";
import { refreshExploreContentWeb } from "@/lib/explore/explore-content-refresh-web";
import type { ExploreModulesBundle } from "@/lib/explore/explore-modules-bundle-types";
import type { ExploreFeaturedArticleView } from "@/lib/explore/read-explore-featured-article-localized";

type Args = {
  initialFeaturedArticles: ExploreFeaturedArticleView[];
  initialModulesBundle: ExploreModulesBundle;
};

export function useExploreHomeContentRefresh({
  initialFeaturedArticles,
  initialModulesBundle,
}: Args): {
  featuredArticles: ExploreFeaturedArticleView[];
  exploreModulesBundle: ExploreModulesBundle;
} {
  const { locale } = useLocale();
  const [featuredArticles, setFeaturedArticles] = useState(initialFeaturedArticles);
  const [exploreModulesBundle, setExploreModulesBundle] = useState(initialModulesBundle);

  useEffect(() => {
    setFeaturedArticles(initialFeaturedArticles);
  }, [initialFeaturedArticles]);

  useEffect(() => {
    setExploreModulesBundle(initialModulesBundle);
  }, [initialModulesBundle]);

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      void refreshExploreContentWeb().then(({ modules, featured }) => {
        if (cancelled) return;
        if (modules) setExploreModulesBundle(modules);
        if (featured) {
          setFeaturedArticles(exploreFeaturedArticleViewsFromBundle(featured, locale));
        }
      });
    };

    const schedule = () => {
      if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => run(), { timeout: 3000 });
      } else {
        window.setTimeout(run, 600);
      }
    };

    schedule();

    const onVisibility = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [locale]);

  return { featuredArticles, exploreModulesBundle };
}
