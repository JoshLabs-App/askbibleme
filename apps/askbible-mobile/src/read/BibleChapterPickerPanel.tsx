import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, type ReactNode } from "react";
import {
  Dimensions,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { resolveUiText } from "../i18n/site-copy";
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

export const CHAPTER_PICKER_MIN_VIEWPORT_H = 320;

/** 选章 Modal 打开后短暂忽略背景点击，避免 Android 同一次触摸误触关闭（TCL 等慢机更明显）。 */
export const CHAPTER_PICKER_OPEN_GUARD_MS = 850;

export function markChapterPickerOpenGuard(now = Date.now()): number {
  return now + CHAPTER_PICKER_OPEN_GUARD_MS;
}

export function isWithinChapterPickerOpenGuard(until: number, now = Date.now()): boolean {
  return now < until;
}

/** Android Modal 打开时 useWindowDimensions 偶发为 0，需回退到 Dimensions。 */
export function resolveChapterPickerWindowWidth(windowWidth: number): number {
  const resolved = windowWidth > 0 ? windowWidth : Dimensions.get("window").width;
  return Math.max(280, resolved);
}

export function resolveChapterPickerViewportHeight(windowHeight: number): number {
  const resolved = windowHeight > 0 ? windowHeight : Dimensions.get("window").height;
  return Math.max(CHAPTER_PICKER_MIN_VIEWPORT_H, Math.round(resolved * 0.7));
}

export function estimateChapterPickerLayout(
  chapterCount: number,
  windowWidth: number,
  viewportMaxHeight: number,
  opts?: { inline?: boolean },
) {
  const inline = opts?.inline === true;
  const safeViewportMaxHeight = Math.max(CHAPTER_PICKER_MIN_VIEWPORT_H, viewportMaxHeight);
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
  const scrollNeeded = contentHeight > safeViewportMaxHeight;
  const sheetHeight = scrollNeeded
    ? safeViewportMaxHeight
    : Math.max(CHAPTER_HEADER_H + CHAPTER_SHEET_PAD * 2 + 80, contentHeight);

  return {
    scrollNeeded,
    sheetHeight,
    scrollHeight: scrollNeeded
      ? Math.max(120, safeViewportMaxHeight - chromeHeight)
      : undefined,
  };
}

/** Android 上先关 Modal 再导航，避免透明遮罩残留拦截触摸。 */
export function deferChapterPickerNavigation(action: () => void): void {
  if (Platform.OS !== "android") {
    action();
    return;
  }
  InteractionManager.runAfterInteractions(() => {
    requestAnimationFrame(action);
  });
}

type ChapterPickerModalProps = {
  visible: boolean;
  sheetHeight: number;
  onRequestClose: () => void;
  onBackdropPress: () => void;
  onBackdropLayout?: (height: number) => void;
  children: ReactNode;
};

/** 选章 Modal 外壳：背景与内容分离，避免 Android 嵌套 Pressable 吞掉章号点击。 */
export function ChapterPickerModal({
  visible,
  sheetHeight,
  onRequestClose,
  onBackdropPress,
  onBackdropLayout,
  children,
}: ChapterPickerModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      presentationStyle="overFullScreen"
      statusBarTranslucent={Platform.OS === "android"}
      onRequestClose={onRequestClose}
    >
      <View
        style={modalFrameStyles.backdrop}
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          if (h > 0) onBackdropLayout?.(h);
        }}
      >
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={onBackdropPress}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          style={[modalFrameStyles.sheet, { height: sheetHeight }]}
          pointerEvents="auto"
        >
          <View style={modalFrameStyles.sheetBody} collapsable={false}>
            {children}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const modalFrameStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: c.modalBackdrop,
    justifyContent: "center",
    paddingHorizontal: CHAPTER_BACKDROP_PAD,
  },
  sheet: {
    width: "100%",
    maxHeight: "70%",
    minHeight: 160,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    ...(Platform.OS === "android" ? { elevation: 8 } : null),
  },
  sheetBody: {
    width: "100%",
    height: "100%",
  },
});

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
  const { width: windowWidthRaw } = useWindowDimensions();
  const windowWidth = resolveChapterPickerWindowWidth(windowWidthRaw);
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
          accessibilityLabel={resolveUiText(locale, "返回书卷", "Back to books")}
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
    return (
      <View
        style={[
          styles.embeddedRoot,
          { height: Math.max(CHAPTER_PICKER_MIN_VIEWPORT_H, viewportHeight) },
        ]}
      >
        {gridBody}
      </View>
    );
  }

  return (
    <View style={styles.modalSheetOuter} collapsable={false}>
      <ReadParchmentBackgroundImage
        fill
        style={[
          styles.modalSheetRoot,
          styles.modalSheetBg,
          layout.scrollNeeded ? styles.modalSheetBgFill : null,
        ]}
        imageStyle={styles.modalSheetBgImage}
      >
        {gridBody}
      </ReadParchmentBackgroundImage>
    </View>
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
  modalSheetOuter: {
    width: "100%",
    height: "100%",
    alignSelf: "stretch",
  },
  modalSheetRoot: {
    width: "100%",
    height: "100%",
    alignSelf: "stretch",
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
