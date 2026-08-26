import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { createT } from "../i18n/site-copy";
import { canonSectionTheme } from "./canon-section-theme";
import { BibleCatalogBookRow } from "./BibleCatalogBookRow";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { BibleCatalogTestamentHeader } from "./BibleCatalogTestamentHeader";
import { BibleCatalogTestamentPager } from "./BibleCatalogTestamentPager";
import { bibleCatalogOutlineStyles as styles } from "./bibleCatalogOutlineStyles";
import { readParchmentTheme as c } from "./readParchmentTheme";
import type { ScriptureCanonCatalogBook, ScriptureCanonCatalogSection } from "./canonCatalog";

type TestamentGroup = {
  testament: "old" | "new";
  sections: ScriptureCanonCatalogSection[];
};

type Props = {
  groups: TestamentGroup[];
  activeBookId?: string;
  activeTestament: "old" | "new";
  paginateByTestament: boolean;
  splitByTestamentColumns: boolean;
  columnLayout: boolean;
  compactMode: boolean;
  showBookSummary: boolean;
  enableBookSummaryToggle?: boolean;
  bookSummaryToggleOn?: boolean;
  onBookSummaryToggleChange?: (on: boolean) => void;
  completedChaptersByBook?: Record<string, number>;
  bookMetaMode: "progress" | "chapterCount" | "none";
  showSectionTint: boolean;
  sectionGapPx?: number;
  sectionStripeFullHeight: boolean;
  lockTextScale: boolean;
  catalogNarrowStyle: { maxWidth: number } | null;
  displayLocale?: AppLocale;
  onSelectTestament: (testament: "old" | "new") => void;
  onBookPress: (book: ScriptureCanonCatalogBook) => void;
};

export function BibleCatalogOutlineContent({
  groups,
  activeBookId,
  activeTestament,
  paginateByTestament,
  splitByTestamentColumns: _splitByTestamentColumns,
  columnLayout,
  compactMode,
  showBookSummary,
  enableBookSummaryToggle = false,
  bookSummaryToggleOn = false,
  onBookSummaryToggleChange,
  completedChaptersByBook,
  bookMetaMode,
  showSectionTint,
  sectionGapPx,
  sectionStripeFullHeight,
  lockTextScale,
  catalogNarrowStyle,
  displayLocale = "zh-CN",
  onSelectTestament,
  onBookPress,
}: Props) {
  const t = createT(displayLocale);
  const allowFontScaling = !lockTextScale;
  const scaledMax = (value: number) => (lockTextScale ? 1 : value);
  const { px } = useReadBibleTypography();
  // 分类标题跟着 +/- 走；以小号 catalog 18 为基准（安卓默认），默认仍是 16/18。
  const sectionTitleSize = Math.max(
    12,
    (compactMode ? 16 : 18) + (px.catalogBookSize - 18),
  );
  const sectionTitleLine = Math.round(sectionTitleSize * 1.3);

  const renderTestamentBlock = (group: TestamentGroup) => (
    <View
      key={group.testament}
      style={[
        styles.testament,
        group.testament === "new" && !columnLayout && styles.testamentNt,
        columnLayout && styles.testamentColumn,
        compactMode && styles.testamentCompact,
        !columnLayout && catalogNarrowStyle,
      ]}
    >
      <View style={styles.testamentBody}>
        {!paginateByTestament && !columnLayout ? (
          <BibleCatalogTestamentHeader
            testament={group.testament}
            compact={columnLayout || compactMode}
            lockTextScale={lockTextScale}
            displayLocale={displayLocale}
          />
        ) : null}
        {group.sections.map((section) => {
          const theme = canonSectionTheme(section.sectionId, group.testament);
          const isNoFillSection =
            section.sectionId === "canon-torah" || section.sectionId === "canon-gospels";
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
                    { color: theme.accent, fontSize: sectionTitleSize, lineHeight: sectionTitleLine },
                  ]}
                  allowFontScaling={allowFontScaling}
                  numberOfLines={1}
                  maxFontSizeMultiplier={scaledMax(1.1)}
                >
                  {section.title}
                </Text>
              </View>
              {section.books.map((book) => (
                <BibleCatalogBookRow
                  key={book.bookId}
                  book={book}
                  activeBookId={activeBookId}
                  completedChaptersByBook={completedChaptersByBook}
                  bookMetaMode={bookMetaMode}
                  compactMode={compactMode}
                  showBookSummary={showBookSummary}
                  themeAccent={theme.accent}
                  onPress={onBookPress}
                  lockTextScale={lockTextScale}
                  displayLocale={displayLocale}
                />
              ))}
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

  const summaryToggle =
    enableBookSummaryToggle && onBookSummaryToggleChange ? (
      <Pressable
        onPress={() => onBookSummaryToggleChange(!bookSummaryToggleOn)}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
          opacity: pressed ? 0.72 : 1,
        })}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityState={{ selected: bookSummaryToggleOn }}
        accessibilityLabel={t("pages.read.catalogBookSummaryToggleA11y")}
      >
        <MaterialIcons
          name="notes"
          size={22}
          color={bookSummaryToggleOn ? c.ink : c.faint}
        />
      </Pressable>
    ) : null;

  const headerGroups = groups.filter(
    (group) => !paginateByTestament || group.testament === activeTestament,
  );
  const oldHeaderGroup = headerGroups.find((g) => g.testament === "old");
  const newHeaderGroup = headerGroups.find((g) => g.testament === "new");

  const catalogContent = (
    <>
      {paginateByTestament ? (
        <BibleCatalogTestamentPager
          activeTestament={activeTestament}
          onSelectTestament={onSelectTestament}
          catalogNarrowStyle={catalogNarrowStyle}
          lockTextScale={lockTextScale}
          displayLocale={displayLocale}
        />
      ) : null}
      {columnLayout ? (
        <View style={[styles.outline, styles.testamentHeadersRow, styles.testamentHeadersWithToggle]}>
          <View style={styles.testamentHeaderSide}>
            {oldHeaderGroup ? (
              <BibleCatalogTestamentHeader
                testament="old"
                compact
                lockTextScale={lockTextScale}
                displayLocale={displayLocale}
              />
            ) : null}
          </View>
          {summaryToggle ?? <View style={{ width: 36, height: 36, marginBottom: 4 }} />}
          <View style={styles.testamentHeaderSide}>
            {newHeaderGroup ? (
              <BibleCatalogTestamentHeader
                testament="new"
                compact
                lockTextScale={lockTextScale}
                displayLocale={displayLocale}
              />
            ) : null}
          </View>
        </View>
      ) : null}
      <View style={[styles.outline, columnLayout && styles.outlineColumns]}>
        {groups
          .filter((group) => !paginateByTestament || group.testament === activeTestament)
          .map((group) => renderTestamentBlock(group))}
      </View>
    </>
  );

  if (paginateByTestament) {
    return (
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
    );
  }

  return catalogContent;
}
