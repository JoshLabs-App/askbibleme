import { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { t } from "../i18n/site-copy";
import { bookNameForId } from "./canonCatalog";
import { canonSectionTheme, READ_NEW_TESTAMENT_ACCENT } from "./canon-section-theme";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { useLocale } from "../i18n/LocaleProvider";
import { ReadParchmentBackgroundImage } from "./ReadParchmentSurface";
import {
  chaptersForBookId,
  groupCanonSectionsByTestament,
  type ScriptureCanonCatalogBook,
  type ScriptureCanonCatalogSection,
} from "./canonCatalog";

const OUTLINE_MAX_W = 380;
const READ_DONE_ACCENT = "#65775C";
const TESTAMENT_INTRO = {
  "zh-CN": {
    old: "旧约讲述上帝创造世界、人类犯罪堕落、上帝拣选以色列并应许救主；",
    new: "新约宣告耶稣基督就是救主，祂完成救赎，使人重新与上帝和好，并带来永恒的新生命。",
  },
  "zh-TW": {
    old: "舊約講述上帝創造世界、人類犯罪墮落、上帝揀選以色列並應許救主；",
    new: "新約宣告耶穌基督就是救主，祂完成救贖，使人重新與上帝和好，並帶來永恆的新生命。",
  },
  en: {
    old: "The Old Testament tells of God's creation of the world, humanity's fall into sin, God's choosing of Israel, and His promise of the coming Savior.",
    new: "The New Testament proclaims that Jesus Christ is the Savior. Through Him redemption is accomplished, people are reconciled to God, and eternal life is given.",
  },
} as const;

function TestamentHeader({
  testament,
  compact = false,
  lockTextScale = true,
}: {
  testament: "old" | "new";
  compact?: boolean;
  lockTextScale?: boolean;
}) {
  const isOld = testament === "old";
  return (
    <View style={[styles.testamentHeaderWrap, compact && styles.testamentHeaderWrapCompact]} accessibilityRole="header">
      <Text
        style={[
          styles.testamentHeaderLabel,
          compact && styles.testamentHeaderLabelCompact,
          isOld ? styles.testamentHeaderLabelOt : styles.testamentHeaderLabelNt,
        ]}
        allowFontScaling={!lockTextScale}
        numberOfLines={1}
        maxFontSizeMultiplier={lockTextScale ? 1 : 1.1}
      >
        {isOld ? t("pages.read.catalogTestamentOld") : t("pages.read.catalogTestamentNew")}
      </Text>
    </View>
  );
}

type Props = {
  sections: ScriptureCanonCatalogSection[];
  activeBookId?: string;
  onPickChapter: (bookId: string, chapter: number) => void;
  showBookSummary?: boolean;
  completedChaptersByBook?: Record<string, number>;
  paginateByTestament?: boolean;
  splitByTestamentColumns?: boolean;
  bookMetaMode?: "progress" | "chapterCount" | "none";
  compactMode?: boolean;
  showSectionTint?: boolean;
  sectionGapPx?: number;
  sectionStripeFullHeight?: boolean;
  lockTextScale?: boolean;
};

export function BibleCatalogOutline({
  sections,
  activeBookId,
  onPickChapter,
  showBookSummary = false,
  completedChaptersByBook,
  paginateByTestament = false,
  splitByTestamentColumns = false,
  bookMetaMode = "progress",
  compactMode = false,
  showSectionTint = true,
  sectionGapPx,
  sectionStripeFullHeight = false,
  lockTextScale = true,
}: Props) {
  const { px } = useReadBibleTypography();
  const { locale } = useLocale();
  const groups = groupCanonSectionsByTestament(sections);
  const [picker, setPicker] = useState<ScriptureCanonCatalogBook | null>(null);
  const [activeTestament, setActiveTestament] = useState<"old" | "new">("old");
  const didAutoPickTestamentRef = useRef(false);

  useEffect(() => {
    if (!paginateByTestament) return;
    // 首页分页固定默认新约；不跟随上次阅读自动跳到旧约。
    setActiveTestament("new");
  }, [paginateByTestament]);

  useEffect(() => {
    if (paginateByTestament) return;
    if (didAutoPickTestamentRef.current) return;
    if (!activeBookId) return;
    for (const group of groups) {
      if (group.sections.some((section) => section.books.some((book) => book.bookId === activeBookId))) {
        setActiveTestament(group.testament);
        didAutoPickTestamentRef.current = true;
        return;
      }
    }
    didAutoPickTestamentRef.current = true;
  }, [activeBookId, groups, paginateByTestament]);

  const openBook = useCallback((book: ScriptureCanonCatalogBook) => {
    setPicker(book);
  }, []);

  const chapters =
    picker && chaptersForBookId(picker.bookId) > 0
      ? Array.from({ length: chaptersForBookId(picker.bookId) }, (_, i) => i + 1)
      : [];

  const columnLayout = splitByTestamentColumns && !paginateByTestament;
  const allowFontScaling = !lockTextScale;
  const scaledMax = (value: number) => (lockTextScale ? 1 : value);

  const renderTestamentBlock = (group: (typeof groups)[number]) => (
    <View
      key={group.testament}
      style={[
        styles.testament,
        group.testament === "new" && !columnLayout && styles.testamentNt,
        columnLayout && styles.testamentColumn,
        compactMode && styles.testamentCompact,
      ]}
    >
      <View style={styles.testamentBody}>
        {!paginateByTestament && !columnLayout ? (
          <TestamentHeader
            testament={group.testament}
            compact={columnLayout || compactMode}
            lockTextScale={lockTextScale}
          />
        ) : null}
        {group.sections.map((section) => {
          const theme = canonSectionTheme(section.sectionId, group.testament);
          const isNoFillSection =
            section.sectionId === "canon-torah" ||
            section.sectionId === "canon-gospels";
          const sectionBody = (
            <>
              <View
                style={[
                  styles.sectionTitleRow,
                  compactMode && styles.sectionTitleRowCompact,
                  sectionStripeFullHeight && styles.sectionTitleRowNoStripe,
                  !sectionStripeFullHeight && { borderLeftColor: theme.accent },
                ]}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    compactMode && styles.sectionTitleCompact,
                    { color: theme.accent },
                  ]}
                  allowFontScaling={allowFontScaling}
                  numberOfLines={1}
                  maxFontSizeMultiplier={scaledMax(1.1)}
                >
                  {section.title}
                </Text>
              </View>
              {section.books.map((book) => {
                const selected = book.bookId === activeBookId;
                const totalChapters = chaptersForBookId(book.bookId);
                const completedChapters = Math.max(
                  0,
                  Math.min(totalChapters, completedChaptersByBook?.[book.bookId] ?? 0),
                );
                const progressRatio =
                  totalChapters > 0 ? Math.max(0, Math.min(1, completedChapters / totalChapters)) : 0;
                const chapterCountText = locale === "en" ? `${totalChapters} ch` : `${totalChapters}章`;
                const showRightMeta = bookMetaMode !== "none";
                return (
                  <Pressable
                    key={book.bookId}
                    onPress={() => openBook(book)}
                    style={({ pressed }) => [
                      styles.bookRow,
                      compactMode && styles.bookRowCompact,
                      showBookSummary && book.summary
                        ? { minHeight: px.catalogBookLine * 2 + 2 }
                        : null,
                      selected && styles.bookRowSelected,
                      pressed && styles.bookRowPressed,
                    ]}
                    accessibilityRole="button"
                  >
                    <View style={[styles.bookCenterCard, compactMode && styles.bookCenterCardCompact]}>
                      <View style={[styles.bookNumBadge, compactMode && styles.bookNumBadgeCompact]}>
                        <Text
                          style={[
                            styles.bookNumBadgeText,
                            compactMode && styles.bookNumBadgeTextCompact,
                            { color: theme.accent },
                          ]}
                          allowFontScaling={allowFontScaling}
                          maxFontSizeMultiplier={scaledMax(1)}
                        >
                          {String(book.bookNumber).padStart(2, "0")}
                        </Text>
                      </View>
                      <View style={styles.bookMainBlock}>
                        <View style={styles.bookTitleSummaryRow}>
                          <Text
                            style={[
                              styles.bookName,
                              styles.bookNameSummaryRow,
                              {
                                  fontSize: compactMode
                                    ? Math.max(16, px.catalogBookSize - 1)
                                    : px.catalogBookSize,
                                  lineHeight: compactMode
                                    ? Math.max(21, px.catalogBookLine - 2)
                                    : px.catalogBookLine,
                              },
                            ]}
                            allowFontScaling={allowFontScaling}
                            numberOfLines={1}
                            maxFontSizeMultiplier={scaledMax(1.1)}
                          >
                            {bookNameForId(book.bookId)}
                          </Text>
                          {showBookSummary && book.summary ? (
                            <Text
                              style={[
                                styles.bookSummaryBelow,
                                {
                                  lineHeight: Math.max(14, Math.round(px.catalogBookLine * 0.74)),
                                },
                              ]}
                              allowFontScaling={allowFontScaling}
                              numberOfLines={2}
                              maxFontSizeMultiplier={scaledMax(1.1)}
                            >
                              {book.summary}
                            </Text>
                          ) : null}
                        </View>
                        {bookMetaMode === "progress" ? (
                          <View style={styles.bookProgressTrackRow}>
                            <View style={styles.bookProgressTrack}>
                              <View
                                style={[
                                  styles.bookProgressFill,
                                  { width: `${Math.round(progressRatio * 100)}%` },
                                  progressRatio <= 0 && styles.bookProgressFillEmpty,
                                ]}
                              />
                            </View>
                          </View>
                        ) : null}
                      </View>
                      {showRightMeta ? (
                        <View style={styles.bookRightMeta}>
                          {bookMetaMode === "chapterCount" ? (
                            <Text
                              style={styles.bookChapterCountText}
                              allowFontScaling={allowFontScaling}
                              numberOfLines={1}
                              maxFontSizeMultiplier={scaledMax(1)}
                            >
                              {chapterCountText}
                            </Text>
                          ) : (
                            <>
                              <Text
                                style={styles.bookProgressText}
                                allowFontScaling={allowFontScaling}
                                numberOfLines={1}
                                maxFontSizeMultiplier={scaledMax(1)}
                              >
                                {`${completedChapters}/${totalChapters}`}
                              </Text>
                            </>
                          )}
                        </View>
                      ) : null}
                      {bookMetaMode === "progress" ? (
                        <Text
                          style={styles.bookChevron}
                          allowFontScaling={allowFontScaling}
                          maxFontSizeMultiplier={scaledMax(1)}
                        >
                          ›
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </>
          );

          return (
            <View
              key={section.sectionId}
              style={[
                styles.sectionBlock,
                compactMode && styles.sectionBlockCompact,
                sectionGapPx != null && { marginBottom: sectionGapPx },
                sectionStripeFullHeight && [
                  styles.sectionBlockWithFullStripe,
                  compactMode && styles.sectionBlockWithFullStripeCompact,
                  { borderLeftColor: theme.accent },
                ],
                { backgroundColor: showSectionTint ? theme.bgTint : "transparent" },
                isNoFillSection && styles.sectionBlockTorahFill,
              ]}
            >
              {sectionBody}
            </View>
          );
        })}
      </View>
    </View>
  );

  const catalogContent = (
    <>
      {paginateByTestament ? (
        <View style={styles.testamentPagerWrap}>
          <View style={styles.testamentPager}>
            <Pressable
              onPress={() => setActiveTestament("old")}
              style={[
                styles.testamentPagerBtn,
                activeTestament === "old" && styles.testamentPagerBtnActive,
                activeTestament === "old" && styles.testamentPagerBtnOtActive,
              ]}
            >
              <Text
                style={[
                  styles.testamentPagerText,
                  activeTestament === "old" && styles.testamentPagerTextActive,
                  activeTestament === "old" && styles.testamentPagerTextOtActive,
                ]}
                allowFontScaling={allowFontScaling}
                maxFontSizeMultiplier={scaledMax(1.1)}
              >
                {t("pages.read.catalogTestamentOld")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTestament("new")}
              style={[
                styles.testamentPagerBtn,
                activeTestament === "new" && styles.testamentPagerBtnActive,
                activeTestament === "new" && styles.testamentPagerBtnNtActive,
              ]}
            >
              <Text
                style={[
                  styles.testamentPagerText,
                  styles.testamentPagerTextNt,
                  activeTestament === "new" && styles.testamentPagerTextActive,
                  activeTestament === "new" && styles.testamentPagerTextNtActive,
                ]}
                allowFontScaling={allowFontScaling}
                maxFontSizeMultiplier={scaledMax(1.1)}
              >
                {t("pages.read.catalogTestamentNew")}
              </Text>
            </Pressable>
          </View>
          <Text
            style={styles.testamentPagerIntro}
            allowFontScaling={allowFontScaling}
            maxFontSizeMultiplier={scaledMax(1.1)}
          >
            {TESTAMENT_INTRO[locale][activeTestament]}
          </Text>
        </View>
      ) : null}
      {columnLayout ? (
        <View style={[styles.outline, styles.outlineColumns, styles.testamentHeadersRow]}>
          {groups
            .filter((group) => !paginateByTestament || group.testament === activeTestament)
            .map((group) => (
              <View key={`header:${group.testament}`} style={styles.testamentColumn}>
                <TestamentHeader
                  testament={group.testament}
                  compact
                  lockTextScale={lockTextScale}
                />
              </View>
            ))}
        </View>
      ) : null}
      <View style={[styles.outline, columnLayout && styles.outlineColumns]}>
        {groups
          .filter((group) => !paginateByTestament || group.testament === activeTestament)
          .map((group) => renderTestamentBlock(group))}
      </View>
    </>
  );

  return (
    <>
      {paginateByTestament ? (
        <View
          style={[
            styles.paginatedCatalogFrame,
            activeTestament === "old"
              ? styles.paginatedCatalogFrameOldActive
              : styles.paginatedCatalogFrameNewActive,
          ]}
        >
          {catalogContent}
        </View>
      ) : (
        catalogContent
      )}
      <Modal visible={picker != null} animationType="fade" transparent onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <ReadParchmentBackgroundImage style={styles.modalSheetBg} imageStyle={styles.modalSheetBgImage}>
              {picker ? (
                <>
                  <View style={styles.modalHeader}>
                    <View>
                      <Text
                        style={styles.modalTitle}
                        allowFontScaling={allowFontScaling}
                        maxFontSizeMultiplier={scaledMax(1.1)}
                      >
                        {bookNameForId(picker.bookId)}
                      </Text>
                    </View>
                    <Pressable onPress={() => setPicker(null)} hitSlop={12}>
                      <Text
                        style={styles.modalClose}
                        allowFontScaling={allowFontScaling}
                        maxFontSizeMultiplier={scaledMax(1)}
                      >
                        ×
                      </Text>
                    </Pressable>
                  </View>
                  <ScrollView contentContainerStyle={styles.chapterGrid}>
                    {chapters.map((ch) => (
                      <Pressable
                        key={ch}
                        onPress={() => {
                          onPickChapter(picker.bookId, ch);
                          setPicker(null);
                        }}
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
                </>
              ) : null}
            </ReadParchmentBackgroundImage>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  paginatedCatalogFrame: {
    width: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(120, 53, 15, 0.24)",
    borderRadius: 10,
    paddingTop: 4,
    paddingHorizontal: 6,
    paddingBottom: 6,
    backgroundColor: "rgba(255, 248, 235, 0.2)",
  },
  paginatedCatalogFrameOldActive: {
    borderColor: "rgba(210, 149, 26, 0.36)",
    backgroundColor: "rgba(210, 149, 26, 0.05)",
  },
  paginatedCatalogFrameNewActive: {
    borderColor: "rgba(210, 149, 26, 0.36)",
    backgroundColor: "rgba(210, 149, 26, 0.05)",
  },
  testamentPagerWrap: {
    width: "100%",
    maxWidth: OUTLINE_MAX_W,
    alignSelf: "center",
    marginBottom: 6,
  },
  testamentPager: {
    width: "100%",
    flexDirection: "row",
  },
  testamentPagerBtn: {
    flex: 1,
    minHeight: 42,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  testamentPagerBtnActive: {
    borderBottomColor: "transparent",
  },
  testamentPagerBtnOtActive: {
    borderBottomColor: "#38486C",
    backgroundColor: "rgba(210, 149, 26, 0.12)",
  },
  testamentPagerBtnNtActive: {
    borderBottomColor: READ_NEW_TESTAMENT_ACCENT,
    backgroundColor: "rgba(210, 149, 26, 0.12)",
  },
  testamentPagerText: {
    fontSize: 18,
    lineHeight: 22,
    ...parchmentSans(700),
    color: "#38486C",
    letterSpacing: 0.8,
    opacity: 0.92,
  },
  testamentPagerTextNt: {
    color: READ_NEW_TESTAMENT_ACCENT,
  },
  testamentPagerTextActive: {
    opacity: 1,
  },
  testamentPagerTextOtActive: {
    color: "#38486C",
  },
  testamentPagerTextNtActive: {
    color: READ_NEW_TESTAMENT_ACCENT,
  },
  testamentPagerIntro: {
    marginTop: 8,
    marginBottom: 2,
    paddingLeft: 8,
    paddingRight: 4,
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
    ...parchmentSans(500),
    textAlign: "left",
  },
  outline: { width: "100%", alignItems: "center" },
  outlineColumns: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 6,
  },
  testamentHeadersRow: {
    marginBottom: 2,
  },
  testament: { marginTop: 4, width: "100%", maxWidth: OUTLINE_MAX_W },
  testamentNt: { marginTop: 0 },
  testamentColumn: {
    flex: 1,
    width: "49%",
    maxWidth: "49%",
  },
  testamentCompact: { marginTop: 2 },
  testamentBody: {
    position: "relative",
    width: "100%",
  },
  testamentHeaderWrap: {
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  testamentHeaderWrapCompact: {
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  testamentHeaderLabel: {
    fontSize: 20,
    ...parchmentSans(700),
    letterSpacing: 2.6,
    lineHeight: 26,
  },
  testamentHeaderLabelCompact: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 1.2,
  },
  testamentHeaderLabelOt: { color: "#38486C" },
  testamentHeaderLabelNt: { color: READ_NEW_TESTAMENT_ACCENT },
  sectionBlock: {
    marginBottom: 2,
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: 0,
  },
  sectionBlockWithFullStripe: {
    borderLeftWidth: 3,
    paddingLeft: 6,
  },
  sectionBlockWithFullStripeCompact: {
    borderLeftWidth: 2,
    paddingLeft: 5,
  },
  sectionBlockCompact: {
    marginBottom: 1,
    paddingVertical: 1,
    paddingHorizontal: 1,
  },
  sectionBlockTorahFill: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
  },
  sectionTitleRow: {
    borderLeftWidth: 4,
    paddingLeft: 8,
    marginBottom: 2,
    marginLeft: 2,
  },
  sectionTitleRowCompact: {
    borderLeftWidth: 3,
    paddingLeft: 6,
    marginBottom: 1,
    marginLeft: 1,
  },
  sectionTitleRowNoStripe: {
    borderLeftWidth: 0,
    paddingLeft: 0,
    marginLeft: 0,
  },
  sectionTitle: {
    fontSize: 14,
    ...parchmentSans(700),
    letterSpacing: 0.6,
    lineHeight: 19,
  },
  sectionTitleCompact: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
  },
  sectionTaglinesWrap: {
    marginLeft: 14,
    marginBottom: 6,
    gap: 1,
  },
  sectionTagline: {
    fontSize: 11,
    lineHeight: 15,
    color: c.muted,
    ...parchmentSans(500),
    opacity: 0.88,
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 1,
    marginBottom: 1,
    borderRadius: 8,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    columnGap: 0,
  },
  bookRowCompact: {
    paddingVertical: 0,
    marginBottom: 0,
  },
  bookRowSelected: { backgroundColor: "rgba(118, 95, 62, 0.08)" },
  bookRowPressed: { backgroundColor: "rgba(118, 95, 62, 0.12)" },
  bookCenterCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 2,
    paddingRight: 2,
    minWidth: 0,
  },
  bookCenterCardCompact: {
    gap: 1,
    paddingLeft: 0,
    paddingRight: 0,
  },
  bookNumBadge: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  bookNumBadgeCompact: {
    width: 26,
    height: 26,
  },
  bookNumBadgeText: {
    fontSize: 16,
    lineHeight: 18,
    ...parchmentSans(600),
    letterSpacing: 0.3,
    fontVariant: ["tabular-nums"],
  },
  bookNumBadgeTextCompact: {
    fontSize: 12,
    lineHeight: 14,
  },
  bookMainBlock: {
    flex: 1,
    minWidth: 0,
  },
  bookProgressTrackRow: {
    marginTop: 4,
    paddingRight: 4,
  },
  bookTitleSummaryRow: {
    flexDirection: "column",
    alignItems: "flex-start",
    minWidth: 0,
    gap: 0,
  },
  bookNameSummaryRow: {
    flexShrink: 1,
  },
  bookRightMeta: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  bookProgressText: {
    fontSize: 15,
    lineHeight: 18,
    ...parchmentSans(400),
    color: c.muted,
    opacity: 0.92,
    fontVariant: ["tabular-nums"],
  },
  bookChapterCountText: {
    fontSize: 14,
    lineHeight: 18,
    ...parchmentSans(500),
    color: c.muted,
    opacity: 0.92,
    fontVariant: ["tabular-nums"],
  },
  bookProgressTrack: {
    width: "100%",
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(118, 95, 62, 0.24)",
    overflow: "hidden",
  },
  bookProgressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: READ_DONE_ACCENT,
  },
  bookProgressFillEmpty: {
    width: 0,
  },
  bookChevron: {
    marginLeft: 0,
    fontSize: 24,
    lineHeight: 24,
    color: c.faint,
    opacity: 0.58,
    ...parchmentSans(400),
  },
  bookSummaryBelow: {
    width: "100%",
    paddingLeft: 1,
    fontSize: 13,
    color: c.muted,
    opacity: 0.88,
    ...parchmentSans(400),
  },
  bookNum: {
    width: 16,
    fontSize: 11,
    ...parchmentSans(600),
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  bookName: {
    flexShrink: 0,
    ...parchmentSans(600),
    letterSpacing: -0.15,
    color: c.ink,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: c.modalBackdrop,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalSheet: {
    maxHeight: "70%",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  modalSheetBg: {
    padding: 16,
    backgroundColor: "rgba(236, 217, 185, 0.66)",
  },
  modalSheetBgImage: {
    borderRadius: 14,
    opacity: 0.92,
  },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  modalTitle: { fontSize: 18, ...parchmentSans(600), color: c.ink },
  modalClose: { fontSize: 28, lineHeight: 28, color: c.faint, paddingHorizontal: 4 },
  chapterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 14,
    justifyContent: "center",
  },
  chapterCell: {
    width: 52,
    height: 44,
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
