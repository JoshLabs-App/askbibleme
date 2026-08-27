import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { InteractionManager, Pressable, View } from "react-native";
import { ExploreText as Text } from "./ExploreText";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import {
  SHELL_TAB_SCROLL_FADE_PRESET,
  readParchmentFadeSafePadding,
} from "../read/readParchmentScrollMask";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shellTabBarScrollPad } from "../shell/shellLayout";
import { useMemberAuth } from "../auth/MemberAuthProvider";
import { useLocale } from "../i18n/LocaleProvider";
import { resolveUiText, t } from "../i18n/site-copy";
import { formatGreetingDisplayName } from "../read/readChapterCompletionPlanPanelHelpers";
import { EXPLORE_ENTRIES } from "./exploreEntries";
import { exploreArticleRoute } from "./exploreFeaturedArticles";
import { isReadingPlannerExploreSlug, readingPlannerRoute } from "./reading-planner/reading-planner-routes";
import { useExploreFeaturedArticles } from "./useExploreFeaturedArticles";
import { refreshExploreContentWhenFocused } from "./refreshExploreContent";
import { EXPLORE_FEATURED_ARTICLE_ICON_BY_SLUG } from "./exploreFeaturedArticleIcons";
import { exploreFeaturedArticleLabel } from "./exploreFeaturedArticleLabels";
import { ExploreEntryIcon } from "./ExploreEntryIcon";
import { asExploreEntryIconShape } from "./exploreStagedEntries";
import { useExploreStagedEntries } from "./useExploreStagedEntries";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useExploreIconGridLayout } from "../read/parchmentColumnLayout";
import {
  EXPLORE_PAGE_TOP_PAD,
  ExploreParchmentPage,
  exploreStyles as s,
  useExploreScrollContentStyle,
} from "./exploreParchmentStyles";
import { ExploreReadingHabitStats } from "./ExploreReadingHabitStats";
import {
  normalizeExploreDisplayName,
  readExploreDisplayName,
  writeExploreDisplayName,
} from "./explore-birth-year-prefs";
import { ExploreGreetingNameModal } from "./ExploreGreetingNameModal";

const SCRIPTURE_ANTHOLOGY_IDS = [
  "word-of-god",
  "narrow-gate",
  "praise-worship",
] as const;

/** 底栏图标区 + 羊皮卷底渐隐；否则末行入口会被浮层 Tab / 中央键挡住。 */
const EXPLORE_HOME_SCROLL_BOTTOM_FADE_EXTRA =
  readParchmentFadeSafePadding(SHELL_TAB_SCROLL_FADE_PRESET).bottom;

export function ExploreScreen() {
  const router = useRouter();
  const exploreFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: EXPLORE_PAGE_TOP_PAD + insets.top,
    paddingBottom: shellTabBarScrollPad(insets.bottom, EXPLORE_HOME_SCROLL_BOTTOM_FADE_EXTRA),
  });
  const iconGrid = useExploreIconGridLayout();
  const { locale } = useLocale();
  const { user, updateLocalDisplayName } = useMemberAuth();
  const [exploreDisplayName, setExploreDisplayName] = useState<string | null>(null);
  const [nameEditorOpen, setNameEditorOpen] = useState(false);
  const rawGreetingName = (exploreDisplayName?.trim() || user?.name || "").trim();
  const greetingName = user
    ? formatGreetingDisplayName(rawGreetingName) || resolveUiText(locale, "用户", "friend")
    : "";
  const greetingTitle = user
    ? resolveUiText(locale, `你好，${greetingName}`, `Hello, ${greetingName}`)
    : resolveUiText(locale, "请登录，解锁更多", "Sign in to unlock more");
  const scriptureAnthologyEntries = SCRIPTURE_ANTHOLOGY_IDS.map((id) =>
    EXPLORE_ENTRIES.find((entry) => entry.id === id),
  ).filter((entry): entry is (typeof EXPLORE_ENTRIES)[number] => Boolean(entry));
  const topEntries = EXPLORE_ENTRIES.filter((entry) => !SCRIPTURE_ANTHOLOGY_IDS.includes(entry.id as never));

  const { articles: featuredArticles } = useExploreFeaturedArticles(locale);
  const gridFeaturedArticles = featuredArticles.filter(
    (article) => !isReadingPlannerExploreSlug(article.slug),
  );
  const { entries: stagedEntries, labelFor: stagedLabelFor } = useExploreStagedEntries();
  const [iconGridsReady, setIconGridsReady] = useState(false);

  // 首次进入后再挂载图标格；离开 Tab 不再拆掉，避免切回来整页重铺。
  useEffect(() => {
    if (!exploreFocused || iconGridsReady) return;
    const task = InteractionManager.runAfterInteractions(() => setIconGridsReady(true));
    return () => task.cancel();
  }, [exploreFocused, iconGridsReady]);

  useFocusEffect(
    useCallback(() => {
      refreshExploreContentWhenFocused();
      let cancelled = false;
      void readExploreDisplayName().then((name) => {
        if (!cancelled) setExploreDisplayName(name);
      });
      return () => {
        cancelled = true;
      };
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
      testID={`explore-tile-${entry.id}`}
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
    <ExploreParchmentPage>
      <ParchmentBottomFadeScrollView
        fadePreset={SHELL_TAB_SCROLL_FADE_PRESET}
        contentContainerStyle={scrollContentStyle}
      >
        <Pressable
          onPress={() => {
            if (user) setNameEditorOpen(true);
            else router.push("/login");
          }}
          accessibilityRole="button"
          accessibilityLabel={user ? t("pages.explore.greetingEditA11y") : greetingTitle}
          style={({ pressed }) => [
            s.titleGreetingWrap,
            pressed && s.titleGreetingPressed,
          ]}
        >
          <Text style={s.title} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.2}>
            {greetingTitle}
          </Text>
        </Pressable>
        <ExploreReadingHabitStats />

        {iconGridsReady ? (
        <View style={s.section}>
          <View style={[s.iconGrid, { gap: iconGrid.gap }]}>
            {topEntries.map(renderEntryTile)}
            {scriptureAnthologyEntries.map(renderEntryTile)}
            {stagedEntries.map(renderStagedEntryTile)}
            {gridFeaturedArticles.map(renderArticleTile)}
          </View>
        </View>
        ) : null}
      </ParchmentBottomFadeScrollView>
      {user ? (
        <ExploreGreetingNameModal
          visible={nameEditorOpen}
          initialName={
            normalizeExploreDisplayName(exploreDisplayName || user.name || "") || greetingName
          }
          onClose={() => setNameEditorOpen(false)}
          onSave={async (name) => {
            const ok = await writeExploreDisplayName(name);
            if (!ok) return;
            await updateLocalDisplayName(name);
            setExploreDisplayName(normalizeExploreDisplayName(name));
            setNameEditorOpen(false);
          }}
        />
      ) : null}
    </ExploreParchmentPage>
  );
}
