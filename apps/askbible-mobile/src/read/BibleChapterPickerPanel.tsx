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
import { useLocale } from "../i18n/LocaleProvider";
import { resolveUiText } from "../i18n/site-copy";
import { bookNameForId, chaptersForBookId } from "./canonCatalog";
import { ReadParchmentBackgroundImage } from "./ReadParchmentSurface";
import { ShellSystemBackButton } from "../shell/ShellSystemBackButton";
import { readParchmentTheme as c } from "./readParchmentTheme";
import {
  bibleChapterPickerModalFrameStyles as modalFrameStyles,
  bibleChapterPickerPanelStyles as styles,
  CHAPTER_BACKDROP_PAD,
  CHAPTER_CELL_H,
  CHAPTER_CELL_W,
  CHAPTER_GRID_GAP,
  CHAPTER_GRID_PAD_TOP,
  CHAPTER_HEADER_H,
  CHAPTER_SHEET_PAD,
} from "./bibleChapterPickerPanelStyles";

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

/** 等当前 Pressable 触摸结束再开 Modal，避免同一次触摸误触背景（双 rAF，勿用固定 120ms）。 */
export function deferAfterRowPress(action: () => void): void {
  requestAnimationFrame(() => {
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
        <ShellSystemBackButton onPress={onBack} />
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
