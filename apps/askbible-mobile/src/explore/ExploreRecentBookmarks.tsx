import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ExploreText as Text } from "./ExploreText";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { listScriptureVerseBookmarks } from "../bible/scripture-verse-bookmarks";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { resolveUiText } from "../i18n/site-copy";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { useScriptureVerseBookmarks } from "../read/useScriptureVerseBookmarks";
import { pushExploreReadChapter } from "./explore-read-chapter-nav";

const MAX_RECENT = 3;

/** 探索首页：最近收藏的最多 3 处经文，可点进继续读。 */
export function ExploreRecentBookmarks() {
  const router = useRouter();
  const { locale } = useLocale();
  const { store } = useScriptureVerseBookmarks();
  const recent = useMemo(
    () => listScriptureVerseBookmarks(store).slice(0, MAX_RECENT),
    [store],
  );

  if (recent.length === 0) return null;

  const heading = resolveUiText(locale, "最近收藏", "Recent favorites");

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.heading}>{heading}</Text>
      {recent.map((item) => {
        const bookName = getScriptureBookDisplayName(item.bookId, locale) || item.bookName;
        const refLabel = `${bookName} ${item.chapter}:${item.verse}`;
        return (
          <Pressable
            key={`${item.translationId}:${item.bookId}:${item.chapter}:${item.verse}`}
            onPress={() =>
              pushExploreReadChapter(
                router,
                { bookId: item.bookId, chapter: item.chapter, verse: item.verse },
                "/explore",
              )
            }
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={refLabel}
          >
            <View style={styles.rowBody}>
              <Text style={styles.rowText} numberOfLines={1}>
                {refLabel}
              </Text>
              {item.text.trim() ? (
                <Text style={styles.versePreview}>{item.text.trim()}</Text>
              ) : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    width: "100%",
    gap: 2,
  },
  heading: {
    marginBottom: 4,
    fontSize: 13,
    lineHeight: 18,
    ...parchmentSans(600),
    color: c.faint,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowText: {
    fontSize: 16,
    lineHeight: 22,
    ...parchmentSans(500),
    color: c.ink,
  },
  versePreview: {
    fontSize: 15,
    lineHeight: 22,
    ...parchmentSans(400),
    color: c.ink,
  },
  chevron: {
    marginLeft: 8,
    marginTop: 1,
    fontSize: 18,
    lineHeight: 22,
    color: c.muted,
  },
  pressed: {
    opacity: 0.72,
    backgroundColor: "rgba(255, 248, 235, 0.55)",
  },
});
