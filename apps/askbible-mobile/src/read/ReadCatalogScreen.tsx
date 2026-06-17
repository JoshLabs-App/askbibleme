import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReadParchmentPageScroll } from "./ReadParchmentPageScroll";
import { READ_TAB_SCROLL_FADE_PRESET } from "./readParchmentScrollMask";
import { t } from "../i18n/site-copy";
import { BibleCatalogOutline } from "./BibleCatalogOutline";
import {
  BibleChapterPickerPanel,
  ChapterPickerModal,
  resolveChapterPickerViewportHeight,
} from "./BibleChapterPickerPanel";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { readCatalogScreenStyles as styles } from "./readCatalogScreenStyles";
import { ReadTodayPlanFooter, ReadTodayPlanReadings } from "./ReadTodayPlanPanel";
import { warmScriptureSearchDatabase } from "../bible/scripture-database";
import { readScriptureSearchRoute } from "./readScriptureSearchRoute";
import { useReadCatalogScreen } from "./useReadCatalogScreen";

type ReadCatalogScreenProps = {
  homeMode?: boolean;
};

export function ReadCatalogScreen({ homeMode = true }: ReadCatalogScreenProps) {
  const insets = useSafeAreaInsets();
  const {
    px,
    primaryTranslationId,
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
