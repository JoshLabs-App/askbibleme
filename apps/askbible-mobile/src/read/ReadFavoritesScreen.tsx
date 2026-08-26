import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import {
  listScriptureVerseBookmarks,
  type ScriptureVerseBookmark,
} from "../bible/scripture-verse-bookmarks";
import { useLocale } from "../i18n/LocaleProvider";
import { t, localizeZhText } from "../i18n/site-copy";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { ReadParchmentPageScroll } from "./ReadParchmentPageScroll";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { readTypography } from "./readTypography";
import { ShellSystemBackButton } from "../shell/ShellSystemBackButton";
import { useScriptureVerseBookmarks } from "./useScriptureVerseBookmarks";

export function ReadFavoritesScreen() {
  const router = useRouter();
  const { store, toggle } = useScriptureVerseBookmarks();
  const { locale } = useLocale();
  const { translationCatalog } = useReadBibleTypography();

  const bookmarks = useMemo(() => listScriptureVerseBookmarks(store), [store]);

  const translationLabel = useCallback(
    (translationId: string) => {
      const meta = translationCatalog.find((tr) => tr.id === translationId);
      if (!meta) return translationId;
      return locale === "en" ? meta.labelEn : localizeZhText(locale, meta.labelZh);
    },
    [translationCatalog, locale],
  );

  const openBookmark = useCallback(
    (item: ScriptureVerseBookmark) => {
      router.push({
        pathname: "/read/[bookId]/[chapter]",
        params: {
          bookId: item.bookId,
          chapter: String(item.chapter),
          verse: String(item.verse),
        },
      });
    },
    [router],
  );

  const removeBookmark = useCallback(
    async (item: ScriptureVerseBookmark) => {
      const added = await toggle({
        bookId: item.bookId,
        bookName: item.bookName,
        chapter: item.chapter,
        verse: item.verse,
        translationId: item.translationId,
        text: item.text,
      });
      if (!added) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [toggle],
  );

  return (
    <View style={styles.root}>
      <ReadParchmentPageScroll inset="sub">
        <ShellSystemBackButton onPress={() => router.back()} />

        <Text style={styles.title}>{t("pages.read.favoritesTitle")}</Text>
        <Text style={styles.lead}>{t("pages.read.favoritesLead")}</Text>

        {bookmarks.length === 0 ? (
          <Text style={styles.empty}>{t("pages.read.favoritesEmpty")}</Text>
        ) : (
          bookmarks.map((item) => (
            <View key={`${item.translationId}:${item.bookId}:${item.chapter}:${item.verse}`} style={styles.row}>
              <Pressable
                onPress={() => openBookmark(item)}
                style={({ pressed }) => [styles.rowBody, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${getScriptureBookDisplayName(item.bookId)} ${item.chapter}:${item.verse}`}
              >
                <Text style={styles.ref}>
                  {getScriptureBookDisplayName(item.bookId)} {item.chapter}:{item.verse}
                  <Text style={styles.refMeta}> · {translationLabel(item.translationId)}</Text>
                </Text>
                <Text style={styles.verseText} numberOfLines={4}>
                  {item.text}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void removeBookmark(item)}
                hitSlop={10}
                style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t("pages.read.favoritesRemoveA11y")}
              >
                <MaterialIcons name="bookmark" size={22} color={readTypography.breadcrumbColor} />
              </Pressable>
            </View>
          ))
        )}
      </ReadParchmentPageScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  back: { alignSelf: "flex-start", marginBottom: 8 },
  backText: {
    fontSize: 14,
    ...parchmentSans(500),
    color: c.muted,
  },
  title: {
    fontSize: 22,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
    marginBottom: 8,
  },
  lead: {
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
    textAlign: "center",
    marginBottom: 16,
  },
  empty: {
    fontSize: 14,
    lineHeight: 22,
    color: c.muted,
    textAlign: "center",
    marginTop: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    paddingVertical: 14,
    gap: 8,
  },
  rowBody: { flex: 1, minWidth: 0 },
  ref: {
    fontSize: 14,
    ...parchmentSans(600),
    color: readTypography.breadcrumbColor,
    marginBottom: 6,
  },
  refMeta: {
    ...parchmentSans(400),
    color: c.faint,
  },
  verseText: {
    fontSize: readTypography.verseFontSize,
    lineHeight: readTypography.verseLineHeight,
    ...parchmentSans(500),
    color: readTypography.verseColor,
  },
  removeBtn: {
    paddingTop: 2,
    paddingLeft: 4,
  },
  pressed: { opacity: 0.88 },
});
