"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { exploreFeaturedArticleViewsFromBundle } from "@/lib/explore/explore-featured-articles-from-bundle";
import { refreshExploreContentWeb } from "@/lib/explore/explore-content-refresh-web";
import type { ExploreFeaturedArticlesBundle } from "@/lib/explore/explore-featured-articles-bundle-types";
import type { ExploreModulesBundle } from "@/lib/explore/explore-modules-bundle-types";
import type { ExploreFeaturedArticleView } from "@/lib/explore/read-explore-featured-article-localized";
import type { AppLocale } from "@/lib/i18n/config";

type Args = {
  initialModulesBundle: ExploreModulesBundle;
  /** 服务端算好的全语言精选文章。 */
  initialFeaturedByLocale: Record<AppLocale, ExploreFeaturedArticleView[]>;
};

/**
 * 精选文章原先由页面按请求语言取好再传进来，那要求服务端读 cookie/Accept-Language，
 * 整页因此只能动态渲染。改为由页面一次算齐三种语言、这里按 `useLocale()` 选。
 *
 * 不在这里直接调 `readExploreFeaturedArticleViews`：它静态 import 的 bundle 有 149KB，
 * 从 "use client" 文件引用会把整份拽进客户端 chunk，把 next build 的编译阶段推爆 4GB 堆。
 * 由服务端算好传下来，客户端依赖图就不必背这份数据。
 *
 * 附带好处：页面可静态生成，且切换语言即时重选、不必刷新。
 */
export function useExploreHomeContentRefresh({
  initialModulesBundle,
  initialFeaturedByLocale,
}: Args): {
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
        : (initialFeaturedByLocale[locale] ?? initialFeaturedByLocale["zh-CN"]),
    [remoteFeaturedBundle, locale, initialFeaturedByLocale],
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
