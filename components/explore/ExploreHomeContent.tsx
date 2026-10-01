"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ExploreGreetingNameModal } from "@/components/explore/ExploreGreetingNameModal";
import { ExploreReadingHabitStats } from "@/components/explore/ExploreReadingHabitStats";
import { ShellMaterialCommunityIcon } from "@/components/shell/ShellMaterialCommunityIcon";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { ExploreModulesBundle } from "@/lib/explore/explore-modules-bundle-types";
import { EXPLORE_FEATURED_ARTICLE_ICON_BY_SLUG } from "@/lib/explore/explore-featured-article-icons";
import { exploreFeaturedArticleLabel } from "@/lib/explore/explore-featured-article-labels";
import {
  exploreArticleHref,
  isExploreFeaturedArticleSlug,
} from "@/lib/explore/explore-featured-article-slugs";
import type { ExploreFeaturedArticleView } from "@/lib/explore/read-explore-featured-article-localized";
import type { AppLocale } from "@/lib/i18n/config";
import {
  normalizeExploreDisplayName,
  readExploreDisplayName,
  writeExploreDisplayName,
} from "@/lib/explore/explore-birth-year-prefs";
import { formatGreetingDisplayName } from "@/lib/read/greeting-display-name";
import { useExploreHomeContentRefresh } from "@/hooks/useExploreHomeContentRefresh";
import {
  isReadingPlannerExploreSlug,
  readingPlannerHref,
} from "@/lib/explore/reading-planner-routes";
import { achCopy } from "@/lib/achievements/achievement-copy";

type Props = {
  exploreModulesBundle: ExploreModulesBundle;
  featuredByLocale: Record<AppLocale, ExploreFeaturedArticleView[]>;
};

/**
 * 探索页以安卓 `ExploreScreen.kt` 为准（DECISIONS D-12）：
 * 问候 → 年度进度 + 三个统计数 → 成就 → 使用时长 → 最近阅读 → 收藏 → 查经资料文章格子。
 * 欢迎 / 读经计划 / 圣经人物等功能格子不在这里出入口（页面本身还在）。
 */
export function ExploreHomeContent({ exploreModulesBundle, featuredByLocale }: Props) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { user } = useAskbibleUser();
  const { featuredArticles: liveFeaturedArticles } = useExploreHomeContentRefresh({
    initialModulesBundle: exploreModulesBundle,
    initialFeaturedByLocale: featuredByLocale,
  });
  const [exploreDisplayName, setExploreDisplayName] = useState<string | null>(null);
  const [nameEditorOpen, setNameEditorOpen] = useState(false);

  useEffect(() => {
    setExploreDisplayName(readExploreDisplayName());
  }, []);

  const rawGreetingName = (exploreDisplayName?.trim() || user?.name || "").trim();
  const greetingName = user
    ? formatGreetingDisplayName(rawGreetingName) || achCopy("native.authDefaultName", locale)
    : "";
  const greetingTitle = user
    ? achCopy("native.authGreetingNamed", locale, { name: greetingName })
    : achCopy("native.authGreetingGuest", locale);

  const gridFeaturedArticles = liveFeaturedArticles.filter(
    (article) => !isReadingPlannerExploreSlug(article.slug),
  );

  const onGreetingPress = useCallback(() => {
    if (user) setNameEditorOpen(true);
    else router.push("/login");
  }, [router, user]);

  const renderFeaturedArticleTile = (article: ExploreFeaturedArticleView) => {
    const icon = isExploreFeaturedArticleSlug(article.slug)
      ? EXPLORE_FEATURED_ARTICLE_ICON_BY_SLUG[article.slug]
      : "file-document-outline";
    const href = isReadingPlannerExploreSlug(article.slug)
      ? readingPlannerHref()
      : exploreArticleHref(article.slug);

    return (
      <Link key={article.slug} href={href} className="explore-icon-tile">
        <span aria-hidden className="explore-icon-circle">
          <ShellMaterialCommunityIcon name={icon} size={28} />
        </span>
        <span className="explore-icon-label">
          {exploreFeaturedArticleLabel(article.slug, locale) ?? article.exploreLabel}
        </span>
      </Link>
    );
  };

  return (
    <div className="explore-home">
      <button
        type="button"
        className="explore-home-greeting"
        onClick={onGreetingPress}
        aria-label={user ? t("pages.explore.greetingEditA11y") : greetingTitle}
      >
        <h1 className="explore-home-title">{greetingTitle}</h1>
      </button>

      <ExploreReadingHabitStats />

      <section className="explore-page-section">
        <div className="explore-icon-grid">
          {gridFeaturedArticles.map(renderFeaturedArticleTile)}
        </div>
      </section>

      {user ? (
        <ExploreGreetingNameModal
          open={nameEditorOpen}
          initialName={
            normalizeExploreDisplayName(exploreDisplayName || user.name || "") || greetingName
          }
          onClose={() => setNameEditorOpen(false)}
          onSave={async (name) => {
            const ok = writeExploreDisplayName(name);
            if (!ok) return;
            setExploreDisplayName(normalizeExploreDisplayName(name));
            setNameEditorOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
