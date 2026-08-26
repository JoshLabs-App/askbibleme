import { useRouter } from "expo-router";
import { useSyncExternalStore } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ExploreText as Text } from "./ExploreText";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { resolveUiText } from "../i18n/site-copy";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import {
  getReadRecentChapters,
  subscribeReadRecentChapters,
} from "../read/read-recent-chapters";
import { pushExploreReadChapter } from "./explore-read-chapter-nav";

/** 探索首页：最近浏览的最多 3 章，可点进继续读。 */
export function ExploreRecentChapters() {
  const router = useRouter();
  const { locale } = useLocale();
  const recent = useSyncExternalStore(
    subscribeReadRecentChapters,
    getReadRecentChapters,
    () => [],
  );

  if (recent.length === 0) return null;

  const heading = resolveUiText(locale, "最近阅读", "Continue reading");

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.heading}>{heading}</Text>
      {recent.map((item) => {
        const bookName = getScriptureBookDisplayName(item.bookId, locale) || item.bookName;
        const label =
          locale === "en"
            ? `${bookName} ${item.chapter}`
            : `${bookName} ${item.chapter}章`;
        return (
          <Pressable
            key={`${item.bookId}:${item.chapter}`}
            onPress={() =>
              pushExploreReadChapter(
                router,
                { bookId: item.bookId, chapter: item.chapter },
                "/explore",
              )
            }
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Text style={styles.rowText} numberOfLines={1}>
              {label}
            </Text>
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
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 22,
    ...parchmentSans(500),
    color: c.ink,
  },
  chevron: {
    marginLeft: 8,
    fontSize: 18,
    lineHeight: 22,
    color: c.muted,
  },
  pressed: {
    opacity: 0.72,
    backgroundColor: "rgba(255, 248, 235, 0.55)",
  },
});
