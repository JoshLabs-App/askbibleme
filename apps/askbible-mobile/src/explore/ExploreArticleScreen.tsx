import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { InteractionManager, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "../i18n/LocaleProvider";
import { localizeZhText, t } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { ReadChapterInfoEditionMarkdown } from "../read/ReadChapterInfoEditionMarkdown";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { shellTabBarScrollPad } from "../shell/shellLayout";
import { resolveRouteParam } from "../navigation/resolveRouteParam";
import { useExploreFeaturedArticle, refreshExploreFeaturedArticlesWhenFocused } from "./useExploreFeaturedArticles";
import { linkifyExploreArticleScriptureRefsForLocale } from "./linkifyExploreArticleScriptureRefsForLocale";
import { ContentCorrectionEntry } from "../content-correction/ContentCorrectionEntry";
import { EXPLORE_PAGE_TOP_PAD, exploreStyles as s, useExploreScrollContentStyle } from "./exploreParchmentStyles";
import { pushExploreReadChapter, useExploreReadReturnPath } from "./explore-read-chapter-nav";

const READ_CHAPTER_PATH = /^\/read\/([A-Za-z0-9]{2,5})\/(\d+)(?:\?verse=(\d+))?$/;

export function ExploreArticleScreen() {
  const router = useRouter();
  const exploreReturn = useExploreReadReturnPath();
  const insets = useSafeAreaInsets();
  const screenFocused = useIsFocused();
  const { locale } = useLocale();
  const { slug: slugParam } = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = resolveRouteParam(slugParam);
  const { article } = useExploreFeaturedArticle(slug, locale);
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: EXPLORE_PAGE_TOP_PAD + insets.top,
    paddingBottom: shellTabBarScrollPad(insets.bottom),
  });
  const [linkedBody, setLinkedBody] = useState("");
  const [markdownReady, setMarkdownReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshExploreFeaturedArticlesWhenFocused();
    }, []),
  );

  useEffect(() => {
    setLinkedBody("");
    setMarkdownReady(false);
    if (!article || !screenFocused) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      const linked = linkifyExploreArticleScriptureRefsForLocale(article.body, locale);
      if (cancelled) return;
      setLinkedBody(linked);
      setMarkdownReady(true);
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [article, locale, screenFocused]);

  const onLinkPress = useCallback(
    (url: string) => {
      const match = READ_CHAPTER_PATH.exec(url);
      if (!match) return true;
      pushExploreReadChapter(
        router,
        {
          bookId: match[1]!.toUpperCase(),
          chapter: Number(match[2]!),
          ...(match[3] ? { verse: match[3] } : {}),
        },
        exploreReturn,
      );
      return false;
    },
    [exploreReturn, router],
  );

  if (!article) {
    return (
      <View style={s.root}>
        <ParchmentBottomFadeScrollView fadePreset="prose" contentContainerStyle={scrollContentStyle}>
          <Pressable onPress={() => router.back()} style={s.backLink} accessibilityRole="button">
            <Text style={s.backLinkText}>{t("pages.explore.articlesBack")}</Text>
          </Pressable>
          <Text style={[s.lead, { marginTop: 24, textAlign: "left" }]}>
            {locale === "en" ? "Article not found." : localizeZhText(locale, "找不到这篇文章。")}
          </Text>
        </ParchmentBottomFadeScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ParchmentBottomFadeScrollView fadePreset="prose" contentContainerStyle={scrollContentStyle}>
        <Pressable onPress={() => router.back()} style={s.backLink} accessibilityRole="button">
          <Text style={s.backLinkText}>{t("pages.explore.articlesBack")}</Text>
        </Pressable>

        <View style={s.articleHeader}>
          <Text style={s.articleTitle} maxFontSizeMultiplier={1.15}>
            {article.title}
          </Text>
        </View>

        <View style={s.articleBody}>
          {markdownReady ? (
            <ReadChapterInfoEditionMarkdown
              content={linkedBody || article.body}
              variant="info"
              onLinkPress={onLinkPress}
            />
          ) : null}
          <ContentCorrectionEntry
            context={{
              scope: "explore_article",
              articleSlug: slug,
              articleTitle: article.title,
            }}
          />
        </View>
      </ParchmentBottomFadeScrollView>
    </View>
  );
}
