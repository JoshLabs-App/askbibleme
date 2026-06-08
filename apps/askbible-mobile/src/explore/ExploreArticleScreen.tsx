import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { ReadChapterInfoEditionMarkdown } from "../read/ReadChapterInfoEditionMarkdown";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { shellTabBarScrollPad } from "../shell/shellLayout";
import { getExploreFeaturedArticleBySlug } from "./exploreFeaturedArticles";
import { linkifyExploreArticleScriptureRefsForLocale } from "./linkifyExploreArticleScriptureRefsForLocale";
import { EXPLORE_PAGE_TOP_PAD, exploreStyles as s } from "./exploreParchmentStyles";

const READ_CHAPTER_PATH = /^\/read\/([A-Za-z0-9]{2,5})\/(\d+)(?:\?verse=(\d+))?$/;

export function ExploreArticleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const article = typeof slug === "string" ? getExploreFeaturedArticleBySlug(slug, locale) : null;
  const linkedBody = useMemo(
    () => (article ? linkifyExploreArticleScriptureRefsForLocale(article.body, locale) : ""),
    [article, locale],
  );

  const onLinkPress = useCallback(
    (url: string) => {
      const match = READ_CHAPTER_PATH.exec(url);
      if (!match) return true;
      router.push({
        pathname: "/read/[bookId]/[chapter]",
        params: {
          bookId: match[1]!.toUpperCase(),
          chapter: match[2]!,
          ...(match[3] ? { verse: match[3] } : {}),
        },
      });
      return false;
    },
    [router],
  );

  if (!article) {
    return (
      <View style={s.root}>
        <ParchmentBottomFadeScrollView
          fadePreset="prose"
          contentContainerStyle={[
            s.scroll,
            {
              paddingTop: EXPLORE_PAGE_TOP_PAD + insets.top,
              paddingBottom: shellTabBarScrollPad(insets.bottom),
            },
          ]}
        >
          <Pressable onPress={() => router.back()} style={s.backLink} accessibilityRole="button">
            <Text style={s.backLinkText}>{t("pages.explore.articlesBack")}</Text>
          </Pressable>
          <Text style={[s.lead, { marginTop: 24, textAlign: "left" }]}>
            {locale === "en" ? "Article not found." : "找不到这篇文章。"}
          </Text>
        </ParchmentBottomFadeScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ParchmentBottomFadeScrollView
        fadePreset="prose"
        contentContainerStyle={[
          s.scroll,
          {
            paddingTop: EXPLORE_PAGE_TOP_PAD + insets.top,
            paddingBottom: shellTabBarScrollPad(insets.bottom),
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={s.backLink} accessibilityRole="button">
          <Text style={s.backLinkText}>{t("pages.explore.articlesBack")}</Text>
        </Pressable>

        <View style={s.articleHeader}>
          <Text style={s.articleTitle} maxFontSizeMultiplier={1.15}>
            {article.title}
          </Text>
        </View>

        <View style={s.articleBody}>
          <ReadChapterInfoEditionMarkdown
            content={linkedBody}
            variant="info"
            onLinkPress={onLinkPress}
          />
        </View>
      </ParchmentBottomFadeScrollView>
    </View>
  );
}
