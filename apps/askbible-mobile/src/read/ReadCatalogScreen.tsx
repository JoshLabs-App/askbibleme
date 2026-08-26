import {
  ActivityIndicator,
  Animated,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReadParchmentPageScroll } from "./ReadParchmentPageScroll";
import { READ_TAB_SCROLL_FADE_PRESET } from "./readParchmentScrollMask";
import { createT, localizeZhText } from "../i18n/site-copy";
import { BibleCatalogOutline } from "./BibleCatalogOutline";
import {
  BibleChapterPickerPanel,
  ChapterPickerModal,
  resolveChapterPickerViewportHeight,
} from "./BibleChapterPickerPanel";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { readCatalogScreenStyles as styles } from "./readCatalogScreenStyles";
import { ReadChapterScreenTopChrome } from "./ReadChapterScreenTopChrome";
import { ReadTodayPlanReadings } from "./ReadTodayPlanPanel";
import { warmScriptureSearchDatabase } from "../bible/scripture-database";
import { readScriptureSearchRoute } from "./readScriptureSearchRoute";
import { useIsFocused } from "@react-navigation/native";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { useReadHomeTodayScriptureAvailability } from "./useReadHomeTodayScriptureAvailability";
import { useReadCatalogScreen } from "./useReadCatalogScreen";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";

type ReadCatalogScreenProps = {
  homeMode?: boolean;
};

export function ReadCatalogScreen({ homeMode = true }: ReadCatalogScreenProps) {
  const insets = useSafeAreaInsets();
  const catalogFocused = useIsFocused();
  const { setReadHomeTodayScriptureReady } = useMusicPlayback();
  const { sizeAtMax, sizeAtMin, bumpSize } = useReadBibleTypography();
  const {
    px,
    primaryTranslationId,
    readDisplayLocale,
    router,
    todayPlan,
    sections,
    lastReadLoading,
    lastRead,
    completedByBook,
    catalogNarrowStyle,
    onCatalogScroll,
    openChapter,
    onCatalogTestamentChange,
    onCatalogBookPress,
    activeHomeVerse,
    verseOpacity,
    chapterPickerBookId,
    chapterPickerLayout,
    closeChapterPicker,
    closeChapterPickerFromBackdrop,
    chapterPickerViewportHeight,
    setMeasuredPickerViewportH,
    windowHeight,
  } = useReadCatalogScreen({ homeMode });
  const t = createT(readDisplayLocale);

  useReadHomeTodayScriptureAvailability({
    enabled: catalogFocused,
    homeMode,
    payload: todayPlan.payload,
    translationId: primaryTranslationId,
    onReadyChange: setReadHomeTodayScriptureReady,
  });

  return (
    <View style={styles.root}>
      {homeMode ? (
        <ReadChapterScreenTopChrome
          showBack={false}
          showAudio={false}
          showLastRead
          insets={insets}
          searchA11yLabel={t("pages.read.chapterChromeSearch")}
          favoritesA11yLabel={t("pages.read.chapterChromeFavorites")}
          increaseSizeA11yLabel={
            readDisplayLocale === "en"
              ? "Increase text size"
              : localizeZhText(readDisplayLocale, "放大字号")
          }
          decreaseSizeA11yLabel={
            readDisplayLocale === "en"
              ? "Decrease text size"
              : localizeZhText(readDisplayLocale, "缩小字号")
          }
          lastReadA11yLabel={
            lastRead
              ? readDisplayLocale === "en"
                ? `Continue ${lastRead.bookName} ${lastRead.chapter}`
                : localizeZhText(
                    readDisplayLocale,
                    `继续阅读 ${lastRead.bookName} 第 ${lastRead.chapter} 章`,
                  )
              : readDisplayLocale === "en"
                ? "No recent chapter"
                : localizeZhText(readDisplayLocale, "暂无最近阅读")
          }
          lastReadDisabled={!lastRead}
          sizeAtMax={sizeAtMax}
          sizeAtMin={sizeAtMin}
          onSearch={() => {
            router.push(readScriptureSearchRoute());
            void warmScriptureSearchDatabase(primaryTranslationId);
          }}
          onFavorites={() => router.push("/read/favorites")}
          onIncreaseSize={() => bumpSize(1)}
          onDecreaseSize={() => bumpSize(-1)}
          onLastRead={() => {
            if (!lastRead) return;
            openChapter(lastRead.bookId, lastRead.chapter);
          }}
        />
      ) : null}
      <ReadParchmentPageScroll
        keyboardShouldPersistTaps="handled"
        fadePreset={READ_TAB_SCROLL_FADE_PRESET}
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
            <ReadTodayPlanReadings plan={todayPlan} />
          </View>
        ) : null}

        <View style={styles.catalogSection}>
          <View style={[styles.catalogInner, homeMode ? null : catalogNarrowStyle]}>
            {sections.length > 0 ? (
              <View style={styles.catalogBlock}>
                <BibleCatalogOutline
                  sections={sections}
                  activeBookId={lastRead?.bookId}
                  onPickChapter={openChapter}
                  onBookPress={onCatalogBookPress}
                  onTestamentChange={onCatalogTestamentChange}
                  showBookSummary={!homeMode}
                  enableBookSummaryToggle={homeMode}
                  completedChaptersByBook={homeMode ? undefined : completedByBook}
                  paginateByTestament={false}
                  splitByTestamentColumns={homeMode}
                  bookMetaMode={homeMode ? "none" : "progress"}
                  compactMode={homeMode}
                  showSectionTint={!homeMode}
                  sectionGapPx={homeMode ? 8 : undefined}
                  sectionStripeFullHeight={homeMode}
                  displayLocale={readDisplayLocale}
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
