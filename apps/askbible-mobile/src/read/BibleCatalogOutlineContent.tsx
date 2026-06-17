import { Text, View } from "react-native";
import { canonSectionTheme } from "./canon-section-theme";
import { BibleCatalogBookRow } from "./BibleCatalogBookRow";
import { BibleCatalogTestamentHeader } from "./BibleCatalogTestamentHeader";
import { BibleCatalogTestamentPager } from "./BibleCatalogTestamentPager";
import { bibleCatalogOutlineStyles as styles } from "./bibleCatalogOutlineStyles";
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
  completedChaptersByBook?: Record<string, number>;
  bookMetaMode: "progress" | "chapterCount" | "none";
  showSectionTint: boolean;
  sectionGapPx?: number;
  sectionStripeFullHeight: boolean;
  lockTextScale: boolean;
  catalogNarrowStyle: { maxWidth: number } | null;
  onSelectTestament: (testament: "old" | "new") => void;
  onBookPress: (book: ScriptureCanonCatalogBook) => void;
};

export function BibleCatalogOutlineContent({
  groups,
  activeBookId,
  activeTestament,
  paginateByTestament,
  splitByTestamentColumns,
  columnLayout,
  compactMode,
  showBookSummary,
  completedChaptersByBook,
  bookMetaMode,
  showSectionTint,
  sectionGapPx,
  sectionStripeFullHeight,
  lockTextScale,
  catalogNarrowStyle,
  onSelectTestament,
  onBookPress,
}: Props) {
  const allowFontScaling = !lockTextScale;
  const scaledMax = (value: number) => (lockTextScale ? 1 : value);

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
                    { color: theme.accent },
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

  const catalogContent = (
    <>
      {paginateByTestament ? (
        <BibleCatalogTestamentPager
          activeTestament={activeTestament}
          onSelectTestament={onSelectTestament}
          catalogNarrowStyle={catalogNarrowStyle}
          lockTextScale={lockTextScale}
        />
      ) : null}
      {columnLayout ? (
        <View style={[styles.outline, styles.outlineColumns, styles.testamentHeadersRow]}>
          {groups
            .filter((group) => !paginateByTestament || group.testament === activeTestament)
            .map((group) => (
              <View key={`header:${group.testament}`} style={styles.testamentColumn}>
                <BibleCatalogTestamentHeader
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
