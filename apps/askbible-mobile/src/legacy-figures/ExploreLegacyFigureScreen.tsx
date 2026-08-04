import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { InteractionManager, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "../i18n/LocaleProvider";
import { localizeZhText, t } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { SHELL_TAB_SCROLL_FADE_PRESET } from "../read/readParchmentScrollMask";
import { ReadChapterInfoEditionMarkdown } from "../read/ReadChapterInfoEditionMarkdown";
import { shellTabBarScrollPad } from "../shell/shellLayout";
import { resolveRouteParam } from "../navigation/resolveRouteParam";
import { linkifyExploreArticleScriptureRefsForLocale } from "../explore/linkifyExploreArticleScriptureRefsForLocale";
import {
  exploreStyles as shared,
  useExploreScrollContentStyle,
  ExploreParchmentPage,
} from "../explore/exploreParchmentStyles";
import { pushExploreReadChapter, useExploreReadReturnPath } from "../explore/explore-read-chapter-nav";
import { useMobileLegacyFiguresBundle } from "./useMobileLegacyFigures";
import { getMobileLegacyFigureBySlug } from "./mobileLegacyFiguresCore";
import { resolveMobileLegacyFigureView } from "./localizeMobileLegacyFigure";
import { legacyFigureScreenStyles as styles } from "./legacyFigureScreenStyles";

const READ_CHAPTER_PATH = /^\/read\/([A-Za-z0-9]{2,5})\/(\d+)(?:\?verse=(\d+))?$/;

export function ExploreLegacyFigureScreen() {
  const router = useRouter();
  const exploreReturn = useExploreReadReturnPath();
  const insets = useSafeAreaInsets();
  const screenFocused = useIsFocused();
  const { locale } = useLocale();
  const bundle = useMobileLegacyFiguresBundle();
  const { slug: slugParam } = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = resolveRouteParam(slugParam);
  const profile = useMemo(() => {
    const raw = slug ? getMobileLegacyFigureBySlug(slug) : null;
    return raw ? resolveMobileLegacyFigureView(raw, locale) : null;
  }, [slug, locale, bundle.contentVersion]);
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: 8 + insets.top,
    paddingBottom: shellTabBarScrollPad(insets.bottom),
  });
  const [linkedBody, setLinkedBody] = useState("");
  const [markdownReady, setMarkdownReady] = useState(false);

  useEffect(() => {
    setLinkedBody("");
    setMarkdownReady(false);
    if (!profile?.article?.body || !screenFocused) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      const linked = linkifyExploreArticleScriptureRefsForLocale(profile.article!.body, locale);
      if (cancelled) return;
      setLinkedBody(linked);
      setMarkdownReady(true);
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [profile, locale, screenFocused]);

  useFocusEffect(
    useCallback(() => {
      // no remote refresh needed for bundled legacy figures
    }, []),
  );

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

  if (!profile) {
    return (
      <ExploreParchmentPage>
        <ParchmentBottomFadeScrollView fadePreset={SHELL_TAB_SCROLL_FADE_PRESET} contentContainerStyle={scrollContentStyle}>
          <Pressable onPress={() => router.back()} style={shared.backLink} accessibilityRole="button">
            <Text style={shared.backLinkText}>{t("pages.explore.articlesBack")}</Text>
          </Pressable>
          <Text style={[shared.lead, { marginTop: 24, textAlign: "left" }]}>
            {locale === "en" ? "Figure not found." : localizeZhText(locale, "找不到这位人物。")}
          </Text>
        </ParchmentBottomFadeScrollView>
      </ExploreParchmentPage>
    );
  }

  const article = profile.article;
  const metaChips = [profile.periodLabelZh, profile.lifespanZh, profile.characterRoleZh].filter(
    (chip): chip is string => Boolean(chip),
  );

  return (
    <ExploreParchmentPage>
      <ParchmentBottomFadeScrollView fadePreset={SHELL_TAB_SCROLL_FADE_PRESET} contentContainerStyle={scrollContentStyle}>
        <Pressable onPress={() => router.back()} style={shared.backLink} accessibilityRole="button">
          <Text style={shared.backLinkText}>{t("pages.explore.figuresBack")}</Text>
        </Pressable>

        <View style={shared.articleHeader}>
          <Text style={shared.articleTitle} maxFontSizeMultiplier={1.15}>
            {profile.displayNameZh}
          </Text>
          {locale !== "en" && profile.englishName ? (
            <Text style={styles.detailPeriod}>{profile.englishName}</Text>
          ) : null}
          {profile.scripturePersonalityZh ? (
            <Text style={styles.subtitle}>{localizeZhText(locale, profile.scripturePersonalityZh)}</Text>
          ) : article?.summary ? (
            <Text style={styles.subtitle}>{localizeZhText(locale, article.summary)}</Text>
          ) : null}
          {metaChips.length ? (
            <View style={styles.metaWrap}>
              {metaChips.map((chip) => (
                <Text key={chip} style={styles.metaChip}>
                  {localizeZhText(locale, chip)}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.articleBody}>
          {article?.body ? (
            markdownReady ? (
              <ReadChapterInfoEditionMarkdown
                content={linkedBody || article.body}
                variant="info"
                plainScriptureLinks
                onLinkPress={onLinkPress}
              />
            ) : null
          ) : (
            <Text style={styles.missingBody}>
              {profile.linkedArticleSlug
                ? localizeZhText(locale, "档案已绑定文章，但预览数据里未找到正文。")
                : localizeZhText(locale, "此人物档案尚未绑定文章正文。")}
            </Text>
          )}
        </View>
      </ParchmentBottomFadeScrollView>
    </ExploreParchmentPage>
  );
}
