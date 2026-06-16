import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useNavigation, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PARCHMENT_CATALOG_MAX_WIDTH_PHONE, useParchmentColumnMaxWidth } from "./parchmentColumnLayout";
import { ReadParchmentPageScroll } from "./ReadParchmentPageScroll";
import { t, localizeZhText } from "../i18n/site-copy";
import { BibleCatalogOutline } from "./BibleCatalogOutline";
import {
  BibleChapterPickerPanel,
  ChapterPickerModal,
  deferChapterPickerNavigation,
  estimateChapterPickerLayout,
  isWithinChapterPickerOpenGuard,
  markChapterPickerOpenGuard,
  resolveChapterPickerViewportHeight,
  resolveChapterPickerWindowWidth,
} from "./BibleChapterPickerPanel";
import { chaptersForBookId } from "./canonCatalog";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { getScriptureCanonCatalogSections } from "./canonCatalog";
import { useLocale } from "../i18n/LocaleProvider";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import { warmScriptureSearchDatabase } from "../bible/scripture-database";
import {
  ensureScriptureTranslationReadyWithFallback,
  preloadPrimaryScriptureTranslation,
} from "../bible/scripture-translation-download";
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

const LAST_READ_LOAD_TIMEOUT_MS = 4_000;
const HOME_VERSE_PREP_TIMEOUT_MS = 12_000;

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
  const catalogFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { px, primaryTranslationId, translationCatalog } = useReadBibleTypography();
  const { locale } = useLocale();
  const [lastReadLoading, setLastReadLoading] = useState(true);
  const [lastRead, setLastRead] = useState<ReadLastPosition | null>(null);
  const [completedByBook, setCompletedByBook] = useState<Record<string, number>>({});
  const [completionCountsReady, setCompletionCountsReady] = useState(false);
  const [homeVerses, setHomeVerses] = useState<Array<{ text: string; reference: string }>>([]);
  const [verseIndex, setVerseIndex] = useState(0);
  const [chapterPickerBookId, setChapterPickerBookId] = useState<string | null>(null);
  const [measuredPickerViewportH, setMeasuredPickerViewportH] = useState(0);
  const chapterPickerOpenGuardUntilRef = useRef(0);
  const verseOpacity = useRef(new Animated.Value(1)).current;
  const verseAnimatingRef = useRef(false);
  const registryPlans = useMemo(() => getLocalReadingPlanRegistry().plans, []);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const catalogMaxWidth = useParchmentColumnMaxWidth(PARCHMENT_CATALOG_MAX_WIDTH_PHONE);
  const catalogNarrowStyle =
    catalogMaxWidth != null ? { maxWidth: catalogMaxWidth } : null;
  const chapterPickerViewportHeight = Math.max(
    resolveChapterPickerViewportHeight(windowHeight),
    measuredPickerViewportH,
  );
  const chapterPickerLayoutWidth = resolveChapterPickerWindowWidth(windowWidth);
  const chapterPickerLayout = useMemo(() => {
    if (!chapterPickerBookId) return null;
    return estimateChapterPickerLayout(
      chaptersForBookId(chapterPickerBookId),
      chapterPickerLayoutWidth,
      chapterPickerViewportHeight,
    );
  }, [chapterPickerBookId, chapterPickerLayoutWidth, chapterPickerViewportHeight]);

  const todayPlan = useTodayReadingPlan(registryPlans, { enabled: catalogFocused });

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

  const closeChapterPicker = useCallback(() => {
    setChapterPickerBookId(null);
    setMeasuredPickerViewportH(0);
  }, []);

  const closeChapterPickerFromBlur = useCallback(() => {
    if (isWithinChapterPickerOpenGuard(chapterPickerOpenGuardUntilRef.current)) return;
    closeChapterPicker();
  }, [closeChapterPicker]);

  const closeChapterPickerFromBackdrop = useCallback(() => {
    if (isWithinChapterPickerOpenGuard(chapterPickerOpenGuardUntilRef.current)) return;
    closeChapterPicker();
  }, [closeChapterPicker]);

  useEffect(() => {
    if (!catalogFocused) {
      closeChapterPickerFromBlur();
      setCompletionCountsReady(false);
      return;
    }
    void preloadPrimaryScriptureTranslation(primaryTranslationId);
    const timer = setTimeout(() => setCompletionCountsReady(true), 3500);
    return () => clearTimeout(timer);
  }, [catalogFocused, closeChapterPickerFromBlur, primaryTranslationId]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") closeChapterPicker();
    });
    return () => sub.remove();
  }, [closeChapterPicker]);

  useEffect(() => {
    if (!catalogFocused || !chapterPickerBookId) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeChapterPicker();
      return true;
    });
    return () => sub.remove();
  }, [catalogFocused, chapterPickerBookId, closeChapterPicker]);

  useEffect(() => {
    if (!catalogFocused) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setLastReadLoading(false);
    }, LAST_READ_LOAD_TIMEOUT_MS);
    void readLastReadPosition()
      .then((pos) => {
        if (cancelled) return;
        setLastRead(pos);
        setLastReadLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLastReadLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [catalogFocused]);

  useEffect(() => {
    if (!catalogFocused || !completionCountsReady) return;
    let cancelled = false;
    const reload = () => {
      void readCompletedChapterCountsByBook(catalogBookIds).then((counts) => {
        if (cancelled) return;
        setCompletedByBook(counts);
      });
    };
    const timer = setTimeout(reload, 0);
    const unsub = subscribeReadChapterCompletion(() => {
      if (catalogFocused && completionCountsReady) reload();
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsub();
    };
  }, [catalogBookIds, catalogFocused, completionCountsReady]);

  const onCatalogScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (event.nativeEvent.contentOffset.y > 72) {
        setCompletionCountsReady(true);
      }
    },
    [],
  );

  const openChapter = useCallback(
    (bookId: string, chapter: number, opts?: OpenChapterOpts) => {
      closeChapterPicker();
      const navigate = () => {
        router.push({
          pathname: "/read/[bookId]/[chapter]",
          params: {
            bookId,
            chapter: String(chapter),
            ...(opts?.planFlow ? { planFlow: "1" } : null),
          },
        });
      };
      deferChapterPickerNavigation(navigate);
    },
    [closeChapterPicker, router],
  );

  const noNextChapter = useCallback(() => {}, []);

  useEffect(() => {
    if (!homeMode || !catalogFocused) return;
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
  }, [catalogFocused, homeMode, homeVerses.length, verseOpacity]);

  useEffect(() => {
    if (!homeMode || !catalogFocused) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      const primaryMeta = translationCatalog.find((tr) => tr.id === primaryTranslationId);
      const labels = {
        labelZh: primaryMeta?.labelZh ?? DEFAULT_SCRIPTURE_LABEL_ZH,
        labelEn: primaryMeta?.labelEn ?? DEFAULT_SCRIPTURE_LABEL_EN,
      };
      const versionLabel = (locale === "en" ? labels.labelEn : localizeZhText(locale, labels.labelZh)).trim();
      void (async () => {
        let readyPrimaryId = primaryTranslationId;
        try {
          readyPrimaryId = await Promise.race([
            ensureScriptureTranslationReadyWithFallback(primaryTranslationId),
            new Promise<string>((resolve) => {
              setTimeout(() => resolve(primaryTranslationId), HOME_VERSE_PREP_TIMEOUT_MS);
            }),
          ]);
        } catch {
          readyPrimaryId = primaryTranslationId;
        }
        if (cancelled) return;

        const chapterCache = new Map<
          string,
          Awaited<ReturnType<typeof loadChapterFromBundledTranslation>>
        >();
        const items: Array<{ text: string; reference: string }> = [];
        for (const ref of HOME_VERSE_ROTATION) {
          const cacheKey = `${readyPrimaryId}:${ref.bookId}:${ref.chapter}`;
          if (!chapterCache.has(cacheKey)) {
            try {
              chapterCache.set(
                cacheKey,
                await loadChapterFromBundledTranslation(
                  ref.bookId,
                  ref.chapter,
                  readyPrimaryId,
                  labels,
                ),
              );
            } catch {
              chapterCache.set(cacheKey, null);
            }
          }
          const loaded = chapterCache.get(cacheKey);
          const bookName = loaded?.bookName || getScriptureBookDisplayName(ref.bookId, locale);
          const verseText = loaded?.verses.find((row) => row.verse === ref.verse)?.text.trim() || "";
          const reference = `${bookName} ${ref.chapter}:${ref.verse}${
            versionLabel ? ` · ${versionLabel}` : ""
          }`;
          items.push({ text: verseText, reference });
        }
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
  }, [catalogFocused, homeMode, locale, primaryTranslationId, translationCatalog]);

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

  const onCatalogTestamentChange = useCallback(() => {
    closeChapterPicker();
  }, [closeChapterPicker]);

  const onCatalogBookPress = useCallback((book: { bookId: string }) => {
    const show = () => {
      chapterPickerOpenGuardUntilRef.current = markChapterPickerOpenGuard();
      setChapterPickerBookId(book.bookId);
    };
    if (Platform.OS === "android") {
      // 等书卷行 onPress 完全结束，避免同一次触摸落到 Modal 背景上立刻关闭。
      setTimeout(show, 120);
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(show);
    });
  }, []);

  const activeHomeVerse = homeVerses[verseIndex] ?? homeVerses[0] ?? null;

  return (
    <View style={styles.root}>
      {homeMode ? (
        <View style={[styles.topActions, { top: insets.top + 50, right: Math.max(insets.right, 8) }]}>
          <Pressable
            onPress={() => {
              void warmScriptureSearchDatabase(primaryTranslationId);
              router.push(readScriptureSearchRoute());
            }}
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
      <ReadParchmentPageScroll
        keyboardShouldPersistTaps="handled"
        maskEnabled={false}
        onScroll={onCatalogScroll}
        scrollEventThrottle={32}
      >
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
          <View style={[styles.catalogInner, catalogNarrowStyle]}>
            {sections.length > 0 ? (
              <View style={styles.catalogBlock}>
                <BibleCatalogOutline
                  sections={sections}
                  activeBookId={lastRead?.bookId}
                  onPickChapter={openChapter}
                  onBookPress={onCatalogBookPress}
                  onTestamentChange={onCatalogTestamentChange}
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
            <Animated.View style={[styles.homeVerseCard, catalogNarrowStyle, { opacity: verseOpacity }]}>
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

      {chapterPickerBookId && chapterPickerLayout ? (
        <ChapterPickerModal
          visible
          sheetHeight={chapterPickerLayout.sheetHeight}
          onRequestClose={closeChapterPicker}
          onBackdropPress={closeChapterPickerFromBackdrop}
          onBackdropLayout={(h) => {
            setMeasuredPickerViewportH(
              Math.max(resolveChapterPickerViewportHeight(windowHeight), Math.round(h * 0.82)),
            );
          }}
        >
          <BibleChapterPickerPanel
            bookId={chapterPickerBookId}
            viewportHeight={chapterPickerViewportHeight}
            onBack={closeChapterPicker}
            onPickChapter={(chapter) => openChapter(chapterPickerBookId, chapter)}
          />
        </ChapterPickerModal>
      ) : null}
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
