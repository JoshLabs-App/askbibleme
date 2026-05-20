import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { copyScriptureVerseToClipboard } from "../bible/copy-scripture-verse-clipboard";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import { resolveReadChapterNeighbors } from "../bible/read-chapter-neighbors";
import type { LoadedChapter } from "../bible/types";
import {
  DEFAULT_SCRIPTURE_LABEL_EN,
  DEFAULT_SCRIPTURE_LABEL_ZH,
} from "../bible/types";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import { BibleCatalogOutline } from "./BibleCatalogOutline";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { getScriptureCanonCatalogSections } from "./canonCatalog";
import { ParchmentBottomFadeScrollView } from "./ParchmentBottomFadeScrollView";
import { ReadChapterPostReadingEditions } from "./ReadChapterPostReadingEditions";
import {
  readChapterScrollBottomPad,
  setReadChapterBottomChromeApi,
} from "./read-chapter-chrome-inset";
import { useShellSwipeAction } from "../shell/useShellSwipeAction";
import { useShellSwipeSuspend } from "../shell/useShellSwipeSuspend";
import { ReadChapterTripleLoopAdvance } from "./ReadChapterTripleLoopAdvance";
import { ReadChapterVerseText } from "./ReadChapterVerseText";
import { parchmentSans, readTypography } from "./readTypography";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { useReadChapterAudio } from "./useReadChapterAudio";
import { useReadChapterSearchFocus } from "./useReadChapterSearchFocus";
import { useScriptureVerseBookmarks } from "./useScriptureVerseBookmarks";
import { ReadVerseBookmarkFeedback } from "./ReadVerseBookmarkFeedback";
import { markTodayReadingChapterVisit } from "./reading-plan/today-reading-done";
import { jumpReadChapter, navigateReadChapter, type ReadChapterNavDirection } from "./read-chapter-nav";
import { trackTelemetry } from "../telemetry/client";
import { writeLastReadPosition } from "./read-last-position";

function parseChapterParam(raw: string | string[] | undefined): number | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function parseBookIdParam(raw: string | string[] | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return String(s || "").trim().toUpperCase();
}

/** 与网站 `--read-parchment-pad-top`（3.75rem + safe-area）对齐，避开顶栏菜单/设置 */
const READ_CHAPTER_SCROLL_TOP_PAD = 60;

export function ReadChapterScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ bookId: string; chapter: string; verse?: string }>();
  const bookId = parseBookIdParam(params.bookId);
  const chapter = parseChapterParam(params.chapter);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapterData, setChapterData] = useState<LoadedChapter | null>(null);
  const [contrastByVerse, setContrastByVerse] = useState<Map<number, string> | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollHeaderHeightRef = useRef(0);
  const lastVerseTapRef = useRef<{ verse: number; at: number } | null>(null);
  const [bookmarkFeedback, setBookmarkFeedback] = useState<string | null>(null);
  const clearBookmarkFeedback = useCallback(() => setBookmarkFeedback(null), []);
  const { isBookmarked, toggle: toggleVerseBookmark } = useScriptureVerseBookmarks();
  const { locale } = useLocale();
  const { px, primaryTranslationId, contrastTranslationId, translationCatalog } =
    useReadBibleTypography();
  const { searchFocusVerse, onScrollViewportLayout, onVerseLayout } = useReadChapterSearchFocus(
    chapterData,
    params.verse,
    scrollRef,
  );

  const catalogSections = useMemo(() => {
    try {
      return getScriptureCanonCatalogSections();
    } catch {
      return [];
    }
  }, []);

  const load = useCallback(async () => {
    if (!bookId || chapter == null) {
      setError(t("pages.read.invalidChapter"));
      setChapterData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setChapterData(null);
    setContrastByVerse(null);
    try {
      const primaryMeta = translationCatalog.find((tr) => tr.id === primaryTranslationId);
      const contrastMeta = contrastTranslationId
        ? translationCatalog.find((tr) => tr.id === contrastTranslationId)
        : null;
      const primaryLabels = {
        labelZh: primaryMeta?.labelZh ?? DEFAULT_SCRIPTURE_LABEL_ZH,
        labelEn: primaryMeta?.labelEn ?? DEFAULT_SCRIPTURE_LABEL_EN,
      };
      const contrastLabels = contrastMeta
        ? { labelZh: contrastMeta.labelZh, labelEn: contrastMeta.labelEn }
        : null;

      const [loaded, contrastLoaded] = await Promise.all([
        loadChapterFromBundledTranslation(bookId, chapter, primaryTranslationId, primaryLabels),
        contrastTranslationId && contrastLabels
          ? loadChapterFromBundledTranslation(
              bookId,
              chapter,
              contrastTranslationId,
              contrastLabels,
            )
          : Promise.resolve(null),
      ]);

      if (!loaded) {
        setChapterData(null);
        setError(t("pages.read.chapterLoadError"));
        return;
      }
      setChapterData(loaded);
      void markTodayReadingChapterVisit(loaded.bookId, loaded.chapter);

      if (contrastLoaded?.verses.length) {
        const map = new Map<number, string>();
        for (const v of contrastLoaded.verses) {
          map.set(v.verse, v.text);
        }
        setContrastByVerse(map);
      }
      await writeLastReadPosition({
        bookId: loaded.bookId,
        chapter: loaded.chapter,
        bookName: loaded.bookName,
      });
    } catch (e) {
      setChapterData(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [bookId, chapter, primaryTranslationId, contrastTranslationId, translationCatalog]);

  useLayoutEffect(() => {
    setChapterData(null);
    setContrastByVerse(null);
    setLoading(true);
    setError(null);
  }, [bookId, chapter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [bookId, chapter]);

  useEffect(() => {
    if (!chapterData) return;
    trackTelemetry("read_chapter_open", {
      book_id: chapterData.bookId,
      chapter: chapterData.chapter,
    });
  }, [chapterData?.bookId, chapterData?.chapter]);

  const neighbors = useMemo(() => {
    if (!chapterData) return { prev: null, next: null };
    return resolveReadChapterNeighbors(chapterData.bookId, chapterData.chapter);
  }, [chapterData]);

  const goNeighbor = useCallback(
    (target: { bookId: string; chapter: number } | null, direction: ReadChapterNavDirection) => {
      if (!target || !chapterData) return;
      if (target.bookId === chapterData.bookId && target.chapter === chapterData.chapter) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigateReadChapter(router, target, direction);
    },
    [chapterData, router],
  );

  const onAdvanceChapterAudio = useCallback(
    (next: { bookId: string; chapter: number }) => {
      goNeighbor(next, "forward");
    },
    [goNeighbor],
  );

  const { activeVerseIndex } = useReadChapterAudio(
    chapterData,
    scrollRef,
    scrollHeaderHeightRef,
    onAdvanceChapterAudio,
  );

  const onChapterSwipe = useCallback(
    (direction: "left" | "right") => {
      // 阅读序：左划下一章（新页从右进），右划上一章（新页从左进）；与首页场景条左右空间模型相反
      if (direction === "left") goNeighbor(neighbors.next, "forward");
      else goNeighbor(neighbors.prev, "back");
    },
    [goNeighbor, neighbors.next, neighbors.prev],
  );

  useShellSwipeAction(Boolean(chapterData) && !jumpOpen, onChapterSwipe);
  useShellSwipeSuspend(jumpOpen);

  const onVersePress = useCallback(
    (verse: number, text: string) => {
      if (!chapterData) return;
      const now = Date.now();
      const prev = lastVerseTapRef.current;
      if (prev?.verse === verse && now - prev.at < 420) {
        lastVerseTapRef.current = null;
        void (async () => {
          const ref = {
            bookId: chapterData.bookId,
            bookName: chapterData.bookName,
            chapter: chapterData.chapter,
            verse,
            translationId: chapterData.translationId,
            text,
          };
          const added = await toggleVerseBookmark(ref);
          if (added) {
            try {
              await copyScriptureVerseToClipboard(ref);
            } catch {
              /* 剪贴板失败不阻断收藏 */
            }
          }
          void Haptics.notificationAsync(
            added
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Warning,
          );
          setBookmarkFeedback(
            added ? t("pages.read.verseBookmarkSaved") : t("pages.read.verseBookmarkRemoved"),
          );
        })();
        return;
      }
      lastVerseTapRef.current = { verse, at: now };
    },
    [chapterData, toggleVerseBookmark],
  );

  const jumpToChapter = useCallback(
    (nextBookId: string, nextChapter: number) => {
      setJumpOpen(false);
      jumpReadChapter(router, { bookId: nextBookId, chapter: nextChapter });
    },
    [router],
  );

  useEffect(() => {
    const syncChrome = () => {
      if (!navigation.isFocused() || !chapterData) {
        setReadChapterBottomChromeApi(null);
        return;
      }
      setReadChapterBottomChromeApi({
        openCatalog: () => setJumpOpen(true),
        goNext: () => goNeighbor(neighbors.next, "forward"),
        hasNext: Boolean(neighbors.next),
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
  }, [chapterData, goNeighbor, navigation, neighbors.next]);

  return (
    <View style={styles.root}>
      {loading ? (
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator color={c.muted} />
          <Text style={styles.statusText}>{t("pages.read.loadingChapter")}</Text>
        </View>
      ) : error ? (
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}>
            <Text style={styles.retryBtnText}>{t("pages.read.retry")}</Text>
          </Pressable>
        </View>
      ) : chapterData ? (
        <ParchmentBottomFadeScrollView
          ref={scrollRef}
          style={styles.scroll}
          onLayout={(e) => onScrollViewportLayout(e.nativeEvent.layout.height)}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: READ_CHAPTER_SCROLL_TOP_PAD + insets.top,
              paddingBottom: readChapterScrollBottomPad(insets.bottom, true),
            },
          ]}
        >
          <View
            style={styles.header}
            onLayout={(e) => {
              scrollHeaderHeightRef.current = Math.round(e.nativeEvent.layout.height);
            }}
          >
            <View style={styles.breadcrumb}>
              <Pressable onPress={() => router.push("/read")} hitSlop={8}>
                <Text style={styles.breadcrumbLink}>{t("pages.read.chapterNavCatalog")}</Text>
              </Pressable>
              <Text style={styles.breadcrumbDot}> · </Text>
              <Pressable onPress={() => router.push("/read")} hitSlop={8}>
                <Text style={styles.breadcrumbLink}>{t("pages.read.chapterNavRead")}</Text>
              </Pressable>
            </View>
            <Text style={[styles.chapterTitle, { fontSize: px.chapterTitleSize }]}>
              {chapterData.bookName} {chapterData.chapter}
            </Text>
            <Text style={styles.chapterMeta}>
              {locale === "en" ? chapterData.labelEn : chapterData.labelZh}
            </Text>
          </View>

          {chapterData.verses.map((v, i) => {
            const searchFocus = searchFocusVerse === v.verse;
            const bookmarked = isBookmarked({
              translationId: chapterData.translationId,
              bookId: chapterData.bookId,
              chapter: chapterData.chapter,
              verse: v.verse,
            });
            const audioActive = !searchFocus && !bookmarked && activeVerseIndex === i;
            return (
              <Pressable
                key={v.verse}
                onPress={() => onVersePress(v.verse, v.text)}
                onLayout={(e) => {
                  const { y, height } = e.nativeEvent.layout;
                  onVerseLayout(v.verse, y, height);
                }}
                accessibilityRole="button"
                accessibilityHint={t("pages.read.verseBookmarkA11yHint")}
              >
                <Text
                  style={[
                    styles.verseLine,
                    {
                      fontSize: px.verseFontSize,
                      lineHeight: px.verseLineHeight,
                    },
                    bookmarked && styles.verseLineBookmark,
                    searchFocus && styles.verseLineSearchFocus,
                    audioActive && styles.verseLineActive,
                  ]}
                  accessibilityRole="text"
                >
                  <Text
                    style={[
                      styles.verseNum,
                      { fontSize: px.verseNumFontSize },
                      bookmarked && styles.verseNumBookmark,
                      searchFocus && styles.verseNumSearchFocus,
                      audioActive && styles.verseNumActive,
                    ]}
                  >
                    {v.verse}{" "}
                  </Text>
                  <ReadChapterVerseText
                    translationId={chapterData.translationId}
                    bookId={chapterData.bookId}
                    chapter={chapterData.chapter}
                    verse={v.verse}
                    text={v.text}
                  />
                  {contrastByVerse?.get(v.verse) ? (
                    <Text style={styles.verseContrast}>{`\n${contrastByVerse.get(v.verse)}`}</Text>
                  ) : null}
                </Text>
              </Pressable>
            );
          })}

          <ReadChapterPostReadingEditions bookId={chapterData.bookId} chapter={chapterData.chapter} />

          <ReadChapterTripleLoopAdvance bookId={chapterData.bookId} chapter={chapterData.chapter} />

          <View style={styles.endNav}>
            <View style={styles.endSide}>
              {neighbors.prev ? (
                <Pressable onPress={() => goNeighbor(neighbors.prev, "back")}>
                  <Text style={styles.endLink}>{t("pages.read.chapterEndNavPrev")}</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={() => setJumpOpen(true)} style={styles.endCenter}>
              <Text style={styles.endCenterText}>{t("pages.read.chapterEndNavCatalogPick")}</Text>
            </Pressable>
            <View style={[styles.endSide, styles.endSideRight]}>
              {neighbors.next ? (
                <Pressable onPress={() => goNeighbor(neighbors.next, "forward")}>
                  <Text style={styles.endLink}>{t("pages.read.chapterEndNavNext")}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </ParchmentBottomFadeScrollView>
      ) : null}

      <ReadVerseBookmarkFeedback message={bookmarkFeedback} onClear={clearBookmarkFeedback} />

      <Modal visible={jumpOpen} animationType="slide" transparent onRequestClose={() => setJumpOpen(false)}>
        <Pressable style={styles.jumpBackdrop} onPress={() => setJumpOpen(false)}>
          <Pressable style={[styles.jumpSheet, { paddingBottom: 16 + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.jumpTitle}>{t("pages.read.chapterJumpTitle")}</Text>
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              <BibleCatalogOutline
                sections={catalogSections}
                activeBookId={bookId}
                onPickChapter={jumpToChapter}
              />
            </ScrollView>
            <Pressable onPress={() => setJumpOpen(false)} style={styles.jumpClose}>
              <Text style={styles.jumpCloseText}>{t("pages.read.chapterJumpClose")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  header: {
    width: "100%",
    paddingTop: 4,
    paddingBottom: 24,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    alignItems: "center",
  },
  breadcrumb: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  breadcrumbLink: {
    fontSize: readTypography.breadcrumbSize,
    color: readTypography.breadcrumbColor,
    ...parchmentSans(500),
    textDecorationLine: "underline",
  },
  breadcrumbDot: { fontSize: readTypography.breadcrumbSize, color: c.faint },
  chapterTitle: {
    marginTop: 14,
    fontSize: readTypography.chapterTitleSize,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  chapterMeta: { marginTop: 4, fontSize: 12, color: c.muted, textAlign: "center" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  statusText: { fontSize: 14, color: c.muted },
  errorText: { fontSize: 14, lineHeight: 22, color: c.muted, textAlign: "center" },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  retryBtnText: { fontSize: 14, ...parchmentSans(600), color: c.ink },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 22,
    maxWidth: 448,
    width: "100%",
    alignSelf: "center",
  },
  verseLine: {
    fontSize: readTypography.verseFontSize,
    lineHeight: readTypography.verseLineHeight,
    ...parchmentSans(500),
    color: readTypography.verseColor,
    marginBottom: 14,
    textAlign: "left",
  },
  verseNum: {
    fontSize: readTypography.verseNumFontSize,
    ...parchmentSans(700),
    color: readTypography.verseNumColor,
  },
  verseLineActive: {
    backgroundColor: c.verseAudioActiveBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.verseAudioActiveBorder,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verseLineSearchFocus: {
    backgroundColor: c.verseSearchFocusBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.verseSearchFocusBorder,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verseLineBookmark: {
    backgroundColor: c.verseBookmarkBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.verseBookmarkBorder,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verseNumActive: { color: c.verseAudioActiveNum },
  verseNumSearchFocus: { color: c.verseSearchFocusNum },
  verseNumBookmark: { color: c.verseBookmarkNum },
  verseContrast: {
    fontSize: readTypography.verseFontSize * 0.92,
    lineHeight: readTypography.verseLineHeight * 0.95,
    color: c.muted,
    ...parchmentSans(400),
  },
  endNav: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 40,
    paddingTop: 8,
    gap: 8,
  },
  endSide: { flex: 1, minWidth: 0 },
  endSideRight: { alignItems: "flex-end" },
  endLink: {
    fontSize: 13,
    ...parchmentSans(500),
    color: readTypography.breadcrumbColor,
    textDecorationLine: "underline",
  },
  endCenter: { flexShrink: 0, maxWidth: 120, paddingHorizontal: 4 },
  endCenterText: {
    fontSize: 16,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  jumpBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: c.modalBackdrop },
  jumpSheet: {
    maxHeight: "82%",
    backgroundColor: c.surfaceSolid,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  jumpTitle: { fontSize: 16, ...parchmentSans(600), color: c.ink, textAlign: "center", marginBottom: 8 },
  jumpClose: { marginTop: 10, alignSelf: "center", paddingVertical: 8 },
  jumpCloseText: { fontSize: 14, color: c.muted },
  pressed: { opacity: 0.88 },
});
