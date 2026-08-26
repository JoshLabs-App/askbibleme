"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EXPLORE_ENTRIES, SCRIPTURE_ANTHOLOGY_IDS } from "@/lib/explore/exploreEntries";
import { ExploreEntryIcon } from "@/components/explore/ExploreEntryIcon";
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
import {
  normalizeExploreDisplayName,
  readExploreDisplayName,
  writeExploreDisplayName,
} from "@/lib/explore/explore-birth-year-prefs";
import { formatGreetingDisplayName } from "@/lib/read/greeting-display-name";
import { asExploreEntryIconShape, type ExploreStagedEntry } from "@/lib/explore/explore-staged-entries";
import { useExploreStagedEntries } from "@/hooks/useExploreStagedEntries";
import { useExploreHomeContentRefresh } from "@/hooks/useExploreHomeContentRefresh";
import {
  isReadingPlannerExploreSlug,
  readingPlannerHref,
} from "@/lib/explore/reading-planner-routes";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

type Props = {
  featuredArticles: ExploreFeaturedArticleView[];
  exploreModulesBundle: ExploreModulesBundle;
};

export function ExploreHomeContent({ featuredArticles, exploreModulesBundle }: Props) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { user } = useAskbibleUser();
  const { featuredArticles: liveFeaturedArticles, exploreModulesBundle: liveModulesBundle } =
    useExploreHomeContentRefresh({ initialFeaturedArticles: featuredArticles, initialModulesBundle: exploreModulesBundle });
  const [exploreDisplayName, setExploreDisplayName] = useState<string | null>(null);
  const [nameEditorOpen, setNameEditorOpen] = useState(false);
  const { entries: stagedEntries, labelFor: stagedLabelFor } = useExploreStagedEntries(liveModulesBundle);

  useEffect(() => {
    setExploreDisplayName(readExploreDisplayName());
  }, []);

  const rawGreetingName = (exploreDisplayName?.trim() || user?.name || "").trim();
  const greetingName = user
    ? formatGreetingDisplayName(rawGreetingName) ||
      (locale === "en" ? "friend" : locale === "zh-TW" ? toZhTwText("用户") : "用户")
    : "";
  const greetingTitle = user
    ? locale === "en"
      ? `Hello, ${greetingName}`
      : locale === "zh-TW"
        ? toZhTwText(`你好，${greetingName}`)
        : `你好，${greetingName}`
    : locale === "en"
      ? "Sign in to unlock more"
      : locale === "zh-TW"
        ? toZhTwText("请登录，解锁更多")
        : "请登录，解锁更多";

  const scriptureAnthologyEntries = SCRIPTURE_ANTHOLOGY_IDS.map((id) =>
    EXPLORE_ENTRIES.find((entry) => entry.id === id),
  ).filter((entry): entry is (typeof EXPLORE_ENTRIES)[number] => Boolean(entry));

  const topEntries = EXPLORE_ENTRIES.filter(
    (entry) => !SCRIPTURE_ANTHOLOGY_IDS.includes(entry.id as (typeof SCRIPTURE_ANTHOLOGY_IDS)[number]),
  );

  const gridFeaturedArticles = liveFeaturedArticles.filter(
    (article) => !isReadingPlannerExploreSlug(article.slug),
  );

  const onGreetingPress = useCallback(() => {
    if (user) setNameEditorOpen(true);
    else router.push("/login");
  }, [router, user]);

  const renderEntryTile = (entry: (typeof EXPLORE_ENTRIES)[number]) => (
    <Link key={entry.id} href={entry.href} className="explore-icon-tile">
      <span aria-hidden className="explore-icon-circle">
        <ExploreEntryIcon entry={entry} size={28} />
      </span>
      <span className="explore-icon-label">{t(entry.labelKey)}</span>
    </Link>
  );

  const renderStagedEntryTile = (entry: ExploreStagedEntry) => (
    <Link key={entry.id} href={entry.href} className="explore-icon-tile">
      <span aria-hidden className="explore-icon-circle">
        <ExploreEntryIcon entry={asExploreEntryIconShape(entry)} size={28} />
      </span>
      <span className="explore-icon-label">{stagedLabelFor(entry)}</span>
    </Link>
  );

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
          {topEntries.map(renderEntryTile)}
          {scriptureAnthologyEntries.map(renderEntryTile)}
          {stagedEntries.map(renderStagedEntryTile)}
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
