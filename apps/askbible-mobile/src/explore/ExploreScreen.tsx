import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { InteractionManager, Pressable, Text, View } from "react-native";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { SHELL_TAB_SCROLL_FADE_PRESET } from "../read/readParchmentScrollMask";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shellTabBarScrollPad } from "../shell/shellLayout";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import { EXPLORE_ENTRIES } from "./exploreEntries";
import { exploreArticleRoute } from "./exploreFeaturedArticles";
import { isReadingPlannerExploreSlug, readingPlannerRoute } from "./reading-planner/reading-planner-routes";
import { useExploreFeaturedArticles, refreshExploreFeaturedArticlesWhenFocused } from "./useExploreFeaturedArticles";
import { refreshExploreContentWhenFocused } from "./refreshExploreContent";
import { EXPLORE_FEATURED_ARTICLE_ICON_BY_SLUG } from "./exploreFeaturedArticleIcons";
import { exploreFeaturedArticleLabel } from "./exploreFeaturedArticleLabels";
import { ExploreEntryIcon } from "./ExploreEntryIcon";
import { asExploreEntryIconShape } from "./exploreStagedEntries";
import { useExploreStagedEntries } from "./useExploreStagedEntries";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useExploreIconGridLayout } from "../read/parchmentColumnLayout";
import { EXPLORE_PAGE_TOP_PAD, exploreStyles as s, useExploreScrollContentStyle } from "./exploreParchmentStyles";

const SCRIPTURE_ANTHOLOGY_IDS = [
  "word-of-god",
  "narrow-gate",
  "praise-worship",
] as const;

export function ExploreScreen() {
  const router = useRouter();
  const exploreFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: EXPLORE_PAGE_TOP_PAD + insets.top,
    paddingBottom: shellTabBarScrollPad(insets.bottom),
  });
  const iconGrid = useExploreIconGridLayout();
  const { locale } = useLocale();
  const scriptureAnthologyEntries = SCRIPTURE_ANTHOLOGY_IDS.map((id) =>
    EXPLORE_ENTRIES.find((entry) => entry.id === id),
  ).filter((entry): entry is (typeof EXPLORE_ENTRIES)[number] => Boolean(entry));
  const topEntries = EXPLORE_ENTRIES.filter((entry) => !SCRIPTURE_ANTHOLOGY_IDS.includes(entry.id as never));

  const { articles: featuredArticles } = useExploreFeaturedArticles(locale);
  const { entries: stagedEntries, labelFor: stagedLabelFor } = useExploreStagedEntries();
  const [iconGridsReady, setIconGridsReady] = useState(false);

  useEffect(() => {
    if (!exploreFocused) {
      setIconGridsReady(false);
      return;
    }
    const task = InteractionManager.runAfterInteractions(() => setIconGridsReady(true));
    return () => task.cancel();
  }, [exploreFocused]);

  useFocusEffect(
    useCallback(() => {
      refreshExploreContentWhenFocused();
    }, []),
  );

  const renderArticleTile = (article: (typeof featuredArticles)[number]) => (
    <Pressable
      key={article.slug}
      onPress={() =>
        router.push(
          isReadingPlannerExploreSlug(article.slug) ? readingPlannerRoute() : exploreArticleRoute(article.slug),
        )
      }
      style={({ pressed }) => [
        s.iconTile,
        { width: iconGrid.tileW },
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

  const renderStagedEntryTile = (entry: (typeof stagedEntries)[number]) => (
    <Pressable
      key={entry.id}
      onPress={() => router.push(entry.href)}
      style={({ pressed }) => [
        s.iconTile,
        { width: iconGrid.tileW },
        pressed && s.iconTilePressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={stagedLabelFor(entry)}
    >
      <View style={s.iconCircle}>
        <ExploreEntryIcon entry={asExploreEntryIconShape(entry)} size={28} color={c.ink} />
      </View>
      <Text
        style={s.iconLabel}
        numberOfLines={2}
        ellipsizeMode="tail"
        maxFontSizeMultiplier={1.1}
      >
        {stagedLabelFor(entry)}
      </Text>
    </Pressable>
  );

  const renderEntryTile = (entry: (typeof EXPLORE_ENTRIES)[number]) => (
    <Pressable
      key={entry.id}
      onPress={() => router.push(entry.href)}
      style={({ pressed }) => [
        s.iconTile,
        { width: iconGrid.tileW },
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
        fadePreset={SHELL_TAB_SCROLL_FADE_PRESET}
        contentContainerStyle={scrollContentStyle}
      >
        <Text style={s.title} maxFontSizeMultiplier={1.2}>
          {t("pages.explore.title")}
        </Text>
        <View style={s.rule} />
        <Text style={s.lead} maxFontSizeMultiplier={1.2}>
          {t("pages.explore.lead")}
        </Text>

        {iconGridsReady ? (
        <View style={s.section}>
          <View style={[s.iconGrid, { gap: iconGrid.gap }]}>
            {topEntries.map(renderEntryTile)}
            {scriptureAnthologyEntries.map(renderEntryTile)}
            {stagedEntries.map(renderStagedEntryTile)}
            {featuredArticles.map(renderArticleTile)}
          </View>
        </View>
        ) : null}
      </ParchmentBottomFadeScrollView>
    </View>
  );
}
