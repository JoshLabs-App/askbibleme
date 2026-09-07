"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { exploreFeaturedArticleViewsFromBundle } from "@/lib/explore/explore-featured-articles-from-bundle";
import { refreshExploreContentWeb } from "@/lib/explore/explore-content-refresh-web";
import type { ExploreFeaturedArticlesBundle } from "@/lib/explore/explore-featured-articles-bundle-types";
import type { ExploreModulesBundle } from "@/lib/explore/explore-modules-bundle-types";
import {
  readExploreFeaturedArticleViews,
  type ExploreFeaturedArticleView,
} from "@/lib/explore/read-explore-featured-article-localized";

type Args = {
  initialModulesBundle: ExploreModulesBundle;
};

/**
 * 精选文章原先由页面按请求语言取好再传进来，那要求服务端读 cookie/Accept-Language，
 * 整页因此只能动态渲染。改为在这里按 `useLocale()` 自行推导：
 * `readExploreFeaturedArticleViews` 是纯函数、数据是静态 import 的 bundle（本就含
 * 中英两份，zh-TW 由 zh-CN 转写），客户端跑得动。
 *
 * 附带两个好处：页面可静态生成；切换语言即时重算，不必刷新。
 */
export function useExploreHomeContentRefresh({ initialModulesBundle }: Args): {
  featuredArticles: ExploreFeaturedArticleView[];
  exploreModulesBundle: ExploreModulesBundle;
} {
  const { locale } = useLocale();
  const [exploreModulesBundle, setExploreModulesBundle] = useState(initialModulesBundle);
  /** 远程拉到的精选文章；为空则用随包内置的那份。 */
  const [remoteFeaturedBundle, setRemoteFeaturedBundle] =
    useState<ExploreFeaturedArticlesBundle | null>(null);

  const featuredArticles = useMemo(
    () =>
      remoteFeaturedBundle
        ? exploreFeaturedArticleViewsFromBundle(remoteFeaturedBundle, locale)
        : readExploreFeaturedArticleViews(locale),
    [remoteFeaturedBundle, locale],
  );

  useEffect(() => {
    setExploreModulesBundle(initialModulesBundle);
  }, [initialModulesBundle]);

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      void refreshExploreContentWeb().then(({ modules, featured }) => {
        if (cancelled) return;
        if (modules) setExploreModulesBundle(modules);
        if (featured) setRemoteFeaturedBundle(featured);
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
    /** 语言变化只影响上面的 useMemo 派生，不必重新拉远程。 */
  }, []);

  return { featuredArticles, exploreModulesBundle };
}
