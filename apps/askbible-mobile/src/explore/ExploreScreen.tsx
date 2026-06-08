import { useRouter } from "expo-router";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shellTabBarScrollPad } from "../shell/shellLayout";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import { EXPLORE_ENTRIES } from "./exploreEntries";
import { exploreArticleRoute, listExploreFeaturedArticles } from "./exploreFeaturedArticles";
import { EXPLORE_FEATURED_ARTICLE_ICON_BY_SLUG } from "./exploreFeaturedArticleIcons";
import { exploreFeaturedArticleLabel } from "./exploreFeaturedArticleLabels";
import { ExploreEntryIcon } from "./ExploreEntryIcon";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { EXPLORE_PAGE_TOP_PAD, exploreStyles as s } from "./exploreParchmentStyles";

const EXPLORE_SCROLL_MAX_W = 448;
const EXPLORE_SCROLL_PAD_X = 22;
const EXPLORE_ICON_COLS = 3;
const EXPLORE_ICON_GRID_GAP = 10;
const SCRIPTURE_ANTHOLOGY_IDS = [
  "years-days-eternity",
  "word-of-god",
  "narrow-gate",
  "praise-worship",
] as const;

export function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const { locale } = useLocale();

  const iconTileW = Math.floor(
    (Math.min(windowW, EXPLORE_SCROLL_MAX_W) -
      EXPLORE_SCROLL_PAD_X * 2 -
      EXPLORE_ICON_GRID_GAP * (EXPLORE_ICON_COLS - 1)) /
      EXPLORE_ICON_COLS,
  );
  const scriptureAnthologyEntries = SCRIPTURE_ANTHOLOGY_IDS.map((id) =>
    EXPLORE_ENTRIES.find((entry) => entry.id === id),
  ).filter((entry): entry is (typeof EXPLORE_ENTRIES)[number] => Boolean(entry));
  const topEntries = EXPLORE_ENTRIES.filter((entry) => !SCRIPTURE_ANTHOLOGY_IDS.includes(entry.id as never));

  const featuredArticles = listExploreFeaturedArticles(locale);

  const renderArticleTile = (article: (typeof featuredArticles)[number]) => (
    <Pressable
      key={article.slug}
      onPress={() => router.push(exploreArticleRoute(article.slug))}
      style={({ pressed }) => [
        s.iconTile,
        { width: iconTileW },
        pressed && s.iconTilePressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={exploreFeaturedArticleLabel(article.slug, locale, article.title)}
    >
      <View style={s.iconCircle}>
        <MaterialCommunityIcons
          name={(EXPLORE_FEATURED_ARTICLE_ICON_BY_SLUG[article.slug] ?? "file-document-outline") as never}
          size={28}
          color={c.ink}
        />
      </View>
      <Text
        style={s.iconLabel}
        numberOfLines={2}
        ellipsizeMode="tail"
        maxFontSizeMultiplier={1.1}
      >
        {exploreFeaturedArticleLabel(article.slug, locale, article.exploreLabel)}
      </Text>
    </Pressable>
  );

  const renderEntryTile = (entry: (typeof EXPLORE_ENTRIES)[number]) => (
    <Pressable
      key={entry.id}
      onPress={() => router.push(entry.href)}
      style={({ pressed }) => [
        s.iconTile,
        { width: iconTileW },
        pressed && s.iconTilePressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t(entry.labelKey)}
    >
      <View style={s.iconCircle}>
        <ExploreEntryIcon entry={entry} size={28} color={c.ink} />
      </View>
      <Text
        style={s.iconLabel}
        numberOfLines={2}
        ellipsizeMode="tail"
        maxFontSizeMultiplier={1.1}
      >
        {t(entry.labelKey)}
      </Text>
    </Pressable>
  );

  return (
    <View style={s.root}>
      <ParchmentBottomFadeScrollView
        contentContainerStyle={[
          s.scroll,
          {
            paddingTop: EXPLORE_PAGE_TOP_PAD + insets.top,
            paddingBottom: shellTabBarScrollPad(insets.bottom),
          },
        ]}
      >
        <Text style={s.title} maxFontSizeMultiplier={1.2}>
          {t("pages.explore.title")}
        </Text>
        <View style={s.rule} />
        <Text style={s.lead} maxFontSizeMultiplier={1.2}>
          {t("pages.explore.lead")}
        </Text>

        <View style={s.section}>
          <View style={s.iconGrid}>
            {topEntries.map(renderEntryTile)}
          </View>
          <View style={s.sectionDivider} />
          <Text style={s.sectionCaption}>
            {locale === "en" ? "Scripture Anthology" : locale === "zh-TW" ? "經文彙編" : "经文汇编"}
          </Text>
          <View style={s.iconGrid}>
            {scriptureAnthologyEntries.map(renderEntryTile)}
          </View>

          <Text style={[s.sectionCaption, { marginTop: 28 }]}>
            {t("pages.explore.articlesHeading")}
          </Text>
          <View style={s.iconGrid}>
            {featuredArticles.map(renderArticleTile)}
          </View>
        </View>
      </ParchmentBottomFadeScrollView>
    </View>
  );
}
