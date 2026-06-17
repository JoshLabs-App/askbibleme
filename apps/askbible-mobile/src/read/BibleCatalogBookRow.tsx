import { Pressable, Text, View } from "react-native";
import { useLocale } from "../i18n/LocaleProvider";
import { bookNameForId, chaptersForBookId, type ScriptureCanonCatalogBook } from "./canonCatalog";
import { bibleCatalogOutlineStyles as styles } from "./bibleCatalogOutlineStyles";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";

type Props = {
  book: ScriptureCanonCatalogBook;
  activeBookId?: string;
  completedChaptersByBook?: Record<string, number>;
  bookMetaMode: "progress" | "chapterCount" | "none";
  compactMode?: boolean;
  showBookSummary?: boolean;
  themeAccent: string;
  onPress: (book: ScriptureCanonCatalogBook) => void;
  lockTextScale?: boolean;
};

export function BibleCatalogBookRow({
  book,
  activeBookId,
  completedChaptersByBook,
  bookMetaMode,
  compactMode = false,
  showBookSummary = false,
  themeAccent,
  onPress,
  lockTextScale = true,
}: Props) {
  const { px } = useReadBibleTypography();
  const { locale } = useLocale();
  const allowFontScaling = !lockTextScale;
  const scaledMax = (value: number) => (lockTextScale ? 1 : value);

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
      onPress={() => onPress(book)}
      style={({ pressed }) => [
        styles.bookRow,
        compactMode && styles.bookRowCompact,
        showBookSummary && book.summary ? { minHeight: px.catalogBookLine * 2 + 2 } : null,
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
              { color: themeAccent },
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
}
