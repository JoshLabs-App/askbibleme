import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReadParchmentPageScroll } from "./ReadParchmentPageScroll";
import { t } from "../i18n/site-copy";
import { BibleCatalogOutline } from "./BibleCatalogOutline";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { getScriptureCanonCatalogSections } from "./canonCatalog";
import { useLocale } from "../i18n/LocaleProvider";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import { ensureScriptureTranslationReadyWithFallback } from "../bible/scripture-translation-download";
import {
  DEFAULT_SCRIPTURE_LABEL_EN,
  DEFAULT_SCRIPTURE_LABEL_ZH,
} from "../bible/types";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { readLastReadPosition, type ReadLastPosition } from "./read-last-position";
import { readScriptureSearchRoute } from "./readScriptureSearchRoute";
import { ReadTodayPlanFooter, ReadTodayPlanReadings } from "./ReadTodayPlanPanel";
import { useTodayReadingPlan } from "./useTodayReadingPlan";
import { getLocalReadingPlanRegistry } from "./reading-plan/fetch-reading-plan-registry";
import { setReadChapterBottomChromeApi } from "./read-chapter-chrome-inset";
import {
  readCompletedChapterCountsByBook,
  subscribeReadChapterCompletion,
} from "./read-chapter-completion";

type ReadCatalogScreenProps = {
  homeMode?: boolean;
};

type OpenChapterOpts = {
  planFlow?: boolean;
};

const HOME_VERSE_ROTATION = [
  { bookId: "JHN", chapter: 3, verse: 16 },
  { bookId: "LUK", chapter: 19, verse: 10 },
  { bookId: "1TI", chapter: 1, verse: 15 },
  { bookId: "2CO", chapter: 5, verse: 19 },
  { bookId: "ROM", chapter: 6, verse: 23 },
  { bookId: "JHN", chapter: 20, verse: 31 },
] as const;

export function ReadCatalogScreen({ homeMode = true }: ReadCatalogScreenProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { px, primaryTranslationId, translationCatalog } = useReadBibleTypography();
  const { locale } = useLocale();
  const [lastReadLoading, setLastReadLoading] = useState(true);
  const [lastRead, setLastRead] = useState<ReadLastPosition | null>(null);
  const [completedByBook, setCompletedByBook] = useState<Record<string, number>>({});
  const [homeVerses, setHomeVerses] = useState<Array<{ text: string; reference: string }>>([]);
  const [verseIndex, setVerseIndex] = useState(0);
  const verseOpacity = useRef(new Animated.Value(1)).current;
  const verseAnimatingRef = useRef(false);
  const registryPlans = useMemo(() => getLocalReadingPlanRegistry().plans, []);

  const todayPlan = useTodayReadingPlan(registryPlans);

  const sections = useMemo(() => {
    try {
      return getScriptureCanonCatalogSections();
    } catch {
      return [];
    }
  }, [locale]);
  const catalogBookIds = useMemo(
    () => sections.flatMap((section) => section.books.map((book) => book.bookId)),
    [sections],
  );

  useEffect(() => {
    let cancelled = false;
    void readLastReadPosition().then((pos) => {
      if (cancelled) return;
      setLastRead(pos);
      setLastReadLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const reload = () => {
      void readCompletedChapterCountsByBook(catalogBookIds).then((counts) => {
        if (cancelled) return;
        setCompletedByBook(counts);
      });
    };
    reload();
    const unsub = subscribeReadChapterCompletion(reload);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [catalogBookIds]);

  const openChapter = useCallback(
    (bookId: string, chapter: number, opts?: OpenChapterOpts) => {
      router.push({
        pathname: "/read/[bookId]/[chapter]",
        params: {
          bookId,
          chapter: String(chapter),
          ...(opts?.planFlow ? { planFlow: "1" } : null),
        },
      });
    },
    [router],
  );

  const noNextChapter = useCallback(() => {}, []);

  useEffect(() => {
    if (!homeMode) return;
    if (homeVerses.length < 2) return;
    setVerseIndex(0);
    verseOpacity.setValue(1);
    const rotateVerse = () => {
      if (verseAnimatingRef.current) return;
      verseAnimatingRef.current = true;
      Animated.timing(verseOpacity, {
        toValue: 0,
        duration: 2000,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          verseAnimatingRef.current = false;
          return;
        }
        setVerseIndex((prev) => (prev + 1) % homeVerses.length);
        Animated.timing(verseOpacity, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }).start(() => {
          verseAnimatingRef.current = false;
        });
      });
    };
    const timer = setInterval(() => {
      rotateVerse();
    }, 15000);
    return () => {
      clearInterval(timer);
      verseAnimatingRef.current = false;
      verseOpacity.stopAnimation();
      verseOpacity.setValue(1);
    };
  }, [homeMode, homeVerses.length, verseOpacity]);

  useEffect(() => {
    if (!homeMode) return;
    let cancelled = false;
    const primaryMeta = translationCatalog.find((tr) => tr.id === primaryTranslationId);
    const labels = {
      labelZh: primaryMeta?.labelZh ?? DEFAULT_SCRIPTURE_LABEL_ZH,
      labelEn: primaryMeta?.labelEn ?? DEFAULT_SCRIPTURE_LABEL_EN,
    };
    const versionLabel = (locale === "en" ? labels.labelEn : labels.labelZh).trim();
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
      const readyPrimaryId = await ensureScriptureTranslationReadyWithFallback(primaryTranslationId);
      const items = await Promise.all(
        HOME_VERSE_ROTATION.map(async (ref) => {
          const loaded = await loadChapterFromBundledTranslation(
            ref.bookId,
            ref.chapter,
            readyPrimaryId,
            labels,
          );
        const bookName = loaded?.bookName || getScriptureBookDisplayName(ref.bookId, locale);
        const verseText = loaded?.verses.find((row) => row.verse === ref.verse)?.text.trim() || "";
        const reference = `${bookName} ${ref.chapter}:${ref.verse}${
          versionLabel ? ` · ${versionLabel}` : ""
        }`;
          return {
            text: verseText,
            reference,
          };
        }),
      );
      if (cancelled) return;
      const usable = items.filter((row) => row.text.length > 0);
      setHomeVerses(usable);
      setVerseIndex(0);
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [homeMode, locale, primaryTranslationId, translationCatalog]);

  useEffect(() => {
    const syncChrome = () => {
      if (!navigation.isFocused()) {
        setReadChapterBottomChromeApi(null);
        return;
      }
      setReadChapterBottomChromeApi({
        goNext: noNextChapter,
        hasNext: false,
      });
    };
    syncChrome();
    const onFocus = navigation.addListener("focus", syncChrome);
    const onBlur = navigation.addListener("blur", () => setReadChapterBottomChromeApi(null));
    return () => {
      onFocus();
      onBlur();
      setReadChapterBottomChromeApi(null);
    };
  }, [navigation, noNextChapter]);

  const activeHomeVerse = homeVerses[verseIndex] ?? homeVerses[0] ?? null;

  return (
    <View style={styles.root}>
      {homeMode ? (
        <View style={[styles.topActions, { top: insets.top + 50, right: Math.max(insets.right, 8) }]}>
          <Pressable
            onPress={() => router.push(readScriptureSearchRoute())}
            style={({ pressed }) => [styles.topActionBtn, pressed && styles.topActionPressed]}
            accessibilityRole="button"
            accessibilityLabel={t("pages.read.chapterChromeSearch")}
          >
            <MaterialIcons name="search" size={21} color="#FFFFFF" style={styles.topActionIcon} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/read/favorites")}
            style={({ pressed }) => [styles.topActionBtn, pressed && styles.topActionPressed]}
            accessibilityRole="button"
            accessibilityLabel={t("pages.read.chapterChromeFavorites")}
          >
            <MaterialIcons name="bookmark-border" size={21} color="#FFFFFF" style={styles.topActionIcon} />
          </Pressable>
        </View>
      ) : null}
      <ReadParchmentPageScroll keyboardShouldPersistTaps="handled">
        {homeMode ? (
          <View style={styles.homeTopStack}>
            <View style={styles.hero}>
              <Text
                style={[
                  styles.titleZh,
                  { fontSize: px.heroZh, lineHeight: px.heroZhLine },
                ]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.1}
              >
                {t("pages.read.title")}
              </Text>
            </View>
            <ReadTodayPlanReadings plan={todayPlan} onOpenChapter={openChapter} />
          </View>
        ) : null}

        <View style={styles.catalogSection}>
          <View style={styles.catalogInner}>
            {sections.length > 0 ? (
              <View style={styles.catalogBlock}>
                <BibleCatalogOutline
                  sections={sections}
                  activeBookId={lastRead?.bookId}
                  onPickChapter={openChapter}
                  showBookSummary
                  completedChaptersByBook={completedByBook}
                  paginateByTestament={homeMode}
                />
              </View>
            ) : lastReadLoading ? (
              <ActivityIndicator color={c.muted} style={styles.catalogLoader} />
            ) : (
              <Text style={styles.todayEmpty} maxFontSizeMultiplier={1.1}>
                {t("pages.read.catalogOutlineCta")}
              </Text>
            )}
          </View>
        </View>

        {homeMode ? <ReadTodayPlanFooter plan={todayPlan} /> : null}
        {homeMode ? (
          <View style={styles.bottomVerseWrap}>
            <Animated.View style={[styles.homeVerseCard, { opacity: verseOpacity }]}>
              <Text
                style={styles.homeVerseText}
                numberOfLines={3}
                ellipsizeMode="tail"
                maxFontSizeMultiplier={1.1}
              >
                {activeHomeVerse?.text ?? ""}
              </Text>
              <Text style={styles.homeVerseRef} maxFontSizeMultiplier={1.1}>
                {activeHomeVerse ? `——${activeHomeVerse.reference}` : ""}
              </Text>
            </Animated.View>
          </View>
        ) : null}
      </ReadParchmentPageScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  homeTopStack: {
    gap: 0,
  },
  hero: { alignItems: "center", paddingHorizontal: 4, paddingTop: 0 },
  titleZh: {
    marginTop: 2,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  homeVerseCard: {
    marginTop: 4,
    paddingHorizontal: 22,
    maxWidth: 380,
    minHeight: 70,
    maxHeight: 70,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 0,
  },
  homeVerseText: {
    fontSize: 14,
    lineHeight: 21,
    color: c.muted,
    textAlign: "center",
    ...parchmentSans(500),
  },
  homeVerseRef: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
    color: c.faint,
    textAlign: "center",
    letterSpacing: 0.3,
    ...parchmentSans(500),
  },
  bottomVerseWrap: {
    width: "100%",
    alignItems: "center",
    marginTop: 100,
    marginBottom: 8,
  },
  catalogLoader: { marginTop: 16, alignSelf: "center" },
  todayCard: { marginTop: 12, paddingVertical: 4 },
  todayPlanName: {
    fontSize: 16,
    ...parchmentSans(500),
    color: c.ink,
    textAlign: "center",
  },
  todayEmpty: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    color: c.muted,
    textAlign: "center",
  },
  catalogSection: {
    marginTop: 8,
    width: "100%",
    alignItems: "center",
    paddingTop: 4,
  },
  catalogInner: {
    width: "100%",
    maxWidth: 380,
  },
  catalogBlock: {
    width: "100%",
  },
  topActions: {
    position: "absolute",
    zIndex: 50,
    gap: 4,
    alignItems: "center",
  },
  topActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.5,
  },
  topActionPressed: {
    opacity: 0.68,
  },
  topActionIcon: {
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  pressed: { opacity: 0.88 },
});
