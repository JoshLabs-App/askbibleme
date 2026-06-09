import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { bookNameForId, chaptersForBookId } from "./canonCatalog";
import { ReadParchmentBackgroundImage } from "./ReadParchmentSurface";
import { readParchmentTheme as c } from "./readParchmentTheme";

const CHAPTER_CELL_W = 52;
const CHAPTER_CELL_H = 44;
const CHAPTER_GRID_GAP = 8;
const CHAPTER_GRID_PAD_TOP = 14;
const CHAPTER_SHEET_PAD = 16;
const CHAPTER_BACKDROP_PAD = 20;
const CHAPTER_HEADER_H = 48;

export function estimateChapterPickerLayout(
  chapterCount: number,
  windowWidth: number,
  viewportMaxHeight: number,
  opts?: { inline?: boolean },
) {
  const inline = opts?.inline === true;
  const modalInnerWidth = windowWidth - CHAPTER_BACKDROP_PAD * 2;
  const gridWidth = inline ? windowWidth - 24 : modalInnerWidth - CHAPTER_SHEET_PAD * 2;
  const cols = Math.max(
    1,
    Math.floor((gridWidth + CHAPTER_GRID_GAP) / (CHAPTER_CELL_W + CHAPTER_GRID_GAP)),
  );
  const rows = Math.ceil(chapterCount / cols);
  const gridHeight =
    CHAPTER_GRID_PAD_TOP +
    rows * CHAPTER_CELL_H +
    Math.max(0, rows - 1) * CHAPTER_GRID_GAP;
  const chromeHeight = inline
    ? CHAPTER_HEADER_H
    : CHAPTER_SHEET_PAD * 2 + CHAPTER_HEADER_H;
  const contentHeight = chromeHeight + gridHeight;
  const scrollNeeded = contentHeight > viewportMaxHeight;

  return {
    scrollNeeded,
    sheetHeight: scrollNeeded ? viewportMaxHeight : undefined,
    scrollHeight: scrollNeeded ? viewportMaxHeight - chromeHeight : undefined,
  };
}

type Props = {
  bookId: string;
  viewportHeight: number;
  onPickChapter: (chapter: number) => void;
  onBack: () => void;
  /** 嵌在已有羊皮弹层内；false 时自带 Modal 羊皮底。 */
  embedded?: boolean;
  lockTextScale?: boolean;
};

export function BibleChapterPickerPanel({
  bookId,
  viewportHeight,
  onPickChapter,
  onBack,
  embedded = false,
  lockTextScale = true,
}: Props) {
  const { locale } = useLocale();
  const { width: windowWidth } = useWindowDimensions();
  const chapterCount = chaptersForBookId(bookId);
  const chapters =
    chapterCount > 0 ? Array.from({ length: chapterCount }, (_, i) => i + 1) : [];
  const allowFontScaling = !lockTextScale;
  const scaledMax = (value: number) => (lockTextScale ? 1 : value);

  const layout = useMemo(
    () =>
      estimateChapterPickerLayout(chapters.length, windowWidth, viewportHeight, {
        inline: embedded,
      }),
    [chapters.length, embedded, viewportHeight, windowWidth],
  );

  const gridBody = (
    <>
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={locale === "en" ? "Back to books" : "返回书卷"}
        >
          <MaterialIcons name="arrow-back-ios-new" size={16} color={c.ink} />
        </Pressable>
        <Text
          style={styles.title}
          allowFontScaling={allowFontScaling}
          maxFontSizeMultiplier={scaledMax(1.1)}
          numberOfLines={1}
        >
          {bookNameForId(bookId)}
        </Text>
        {embedded ? (
          <View style={styles.headerSideSpacer} />
        ) : (
          <Pressable onPress={onBack} hitSlop={12}>
            <Text
              style={styles.closeMark}
              allowFontScaling={allowFontScaling}
              maxFontSizeMultiplier={scaledMax(1)}
            >
              ×
            </Text>
          </Pressable>
        )}
      </View>
      {layout.scrollNeeded ? (
        <ScrollView
          style={{ height: layout.scrollHeight }}
          contentContainerStyle={styles.chapterGrid}
          showsVerticalScrollIndicator
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {chapters.map((ch) => (
            <Pressable
              key={ch}
              onPress={() => onPickChapter(ch)}
              style={({ pressed }) => [styles.chapterCell, pressed && styles.chapterCellPressed]}
            >
              <Text
                style={styles.chapterCellText}
                allowFontScaling={allowFontScaling}
                maxFontSizeMultiplier={scaledMax(1)}
              >
                {ch}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.chapterGrid}>
          {chapters.map((ch) => (
            <Pressable
              key={ch}
              onPress={() => onPickChapter(ch)}
              style={({ pressed }) => [styles.chapterCell, pressed && styles.chapterCellPressed]}
            >
              <Text
                style={styles.chapterCellText}
                allowFontScaling={allowFontScaling}
                maxFontSizeMultiplier={scaledMax(1)}
              >
                {ch}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );

  if (embedded) {
    return <View style={[styles.embeddedRoot, { height: viewportHeight }]}>{gridBody}</View>;
  }

  return (
    <ReadParchmentBackgroundImage
      style={[
        styles.modalSheetBg,
        layout.scrollNeeded ? styles.modalSheetBgFill : null,
      ]}
      imageStyle={styles.modalSheetBgImage}
    >
      {gridBody}
    </ReadParchmentBackgroundImage>
  );
}

const styles = StyleSheet.create({
  embeddedRoot: {
    width: "100%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: CHAPTER_HEADER_H,
  },
  headerSideSpacer: { width: 30, height: 30 },
  backBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 249, 239, 0.72)",
  },
  backBtnPressed: {
    backgroundColor: "rgba(118, 95, 62, 0.12)",
  },
  title: {
    flex: 1,
    fontSize: 17,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  closeMark: {
    fontSize: 28,
    lineHeight: 28,
    color: c.faint,
    paddingHorizontal: 4,
  },
  modalSheetBg: {
    padding: CHAPTER_SHEET_PAD,
    backgroundColor: "transparent",
  },
  modalSheetBgFill: {
    flex: 1,
  },
  modalSheetBgImage: {
    borderRadius: 14,
    opacity: 0.92,
  },
  chapterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CHAPTER_GRID_GAP,
    paddingTop: CHAPTER_GRID_PAD_TOP,
    justifyContent: "center",
  },
  chapterCell: {
    width: CHAPTER_CELL_W,
    height: CHAPTER_CELL_H,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 250, 242, 0.58)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.chapterCellBorder,
  },
  chapterCellPressed: {
    backgroundColor: "rgba(255, 246, 234, 0.74)",
    borderColor: c.borderStrong,
  },
  chapterCellText: { fontSize: 15, ...parchmentSans(600), color: c.ink },
});
