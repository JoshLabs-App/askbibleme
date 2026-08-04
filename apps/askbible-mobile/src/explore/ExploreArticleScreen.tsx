import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "../i18n/LocaleProvider";
import { localizeZhText, t } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { SHELL_TAB_SCROLL_FADE_PRESET } from "../read/readParchmentScrollMask";
import { ReadChapterInfoEditionMarkdown } from "../read/ReadChapterInfoEditionMarkdown";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { shellTabBarScrollPad } from "../shell/shellLayout";
import { resolveRouteParam } from "../navigation/resolveRouteParam";
import { useExploreFeaturedArticle, refreshExploreFeaturedArticlesWhenFocused } from "./useExploreFeaturedArticles";
import { ContentCorrectionEntry } from "../content-correction/ContentCorrectionEntry";
import {
  EXPLORE_PAGE_TOP_PAD,
  exploreStyles as s,
  useExploreScrollContentStyle,
  ExploreParchmentPage,
} from "./exploreParchmentStyles";
import { normalizeAskbibleAppHref, parseReadPath } from "../../../../lib/bible/parse-askbible-read-link";
import {
  pushExploreReadChapter,
  returnToExploreIndex,
  useExploreReadReturnPath,
} from "./explore-read-chapter-nav";
import { pushExploreReadPlan } from "./explore-read-plan-nav";
import { ExploreFeaturedArticleSections } from "./ExploreFeaturedArticleSections";
import { exploreFeaturedArticleUsesProseLayout } from "../../../../lib/explore/explore-featured-article-slugs";

export function ExploreArticleScreen() {
  const router = useRouter();
  const exploreReturn = useExploreReadReturnPath();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const { slug: slugParam } = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = resolveRouteParam(slugParam);
  const { article } = useExploreFeaturedArticle(slug, locale);
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: EXPLORE_PAGE_TOP_PAD + insets.top,
    paddingBottom: shellTabBarScrollPad(insets.bottom),
  });
  useFocusEffect(
    useCallback(() => {
      refreshExploreFeaturedArticlesWhenFocused();
    }, []),
  );

  const onLinkPress = useCallback(
    (url: string) => {
      const href = normalizeAskbibleAppHref(url);
      if (pushExploreReadPlan(router, href)) return false;
      const parsed = parseReadPath(href);
      if (!parsed) return true;
      pushExploreReadChapter(
        router,
        {
          bookId: parsed.bookId,
          chapter: parsed.chapter,
          ...(parsed.verse != null ? { verse: parsed.verse } : {}),
        },
        exploreReturn,
      );
      return false;
    },
    [exploreReturn, router],
  );

  if (!article) {
    return (
      <ExploreParchmentPage>
        <ParchmentBottomFadeScrollView fadePreset={SHELL_TAB_SCROLL_FADE_PRESET} contentContainerStyle={scrollContentStyle}>
          <Pressable onPress={() => returnToExploreIndex(router)} style={s.backLink} accessibilityRole="button">
            <Text style={s.backLinkText}>{t("pages.explore.articlesBack")}</Text>
          </Pressable>
          <Text style={[s.lead, { marginTop: 24, textAlign: "left" }]}>
            {locale === "en" ? "Article not found." : localizeZhText(locale, "找不到这篇文章。")}
          </Text>
        </ParchmentBottomFadeScrollView>
      </ExploreParchmentPage>
    );
  }

  return (
    <ExploreParchmentPage>
      <ParchmentBottomFadeScrollView fadePreset={SHELL_TAB_SCROLL_FADE_PRESET} contentContainerStyle={scrollContentStyle}>
        <Pressable onPress={() => returnToExploreIndex(router)} style={s.backLink} accessibilityRole="button">
          <Text style={s.backLinkText}>{t("pages.explore.articlesBack")}</Text>
        </Pressable>

        <View style={s.articleHeader}>
          <Text style={s.articleTitle} maxFontSizeMultiplier={1.15}>
            {article.title}
          </Text>
        </View>

        <View style={s.articleBody}>
          {article.sections.length > 0 && !exploreFeaturedArticleUsesProseLayout(article.slug) ? (
            <>
              <Text style={s.articleSectionHint}>
                {locale === "en"
                  ? "Tap a section to expand or collapse."
                  : localizeZhText(locale, "点按段落可展开或收起")}
              </Text>
              <ExploreFeaturedArticleSections sections={article.sections} onLinkPress={onLinkPress} />
            </>
          ) : (
            <ReadChapterInfoEditionMarkdown
              content={article.body}
              variant="info"
              exploreArticle
              plainScriptureLinks
              onLinkPress={onLinkPress}
            />
          )}
          <ContentCorrectionEntry
            context={{
              scope: "explore_article",
              articleSlug: slug,
              articleTitle: article.title,
            }}
          />
        </View>
      </ParchmentBottomFadeScrollView>
    </ExploreParchmentPage>
  );
}
