import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { InteractionManager, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { useLocale } from "../i18n/LocaleProvider";
import { localizeZhText, t } from "../i18n/site-copy";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { SHELL_TAB_SCROLL_FADE_PRESET } from "../read/readParchmentScrollMask";
import { shellTabBarScrollPad } from "../shell/shellLayout";
import {
  exploreStyles as shared,
  useExploreScrollContentStyle,
  ExploreParchmentPage,
} from "../explore/exploreParchmentStyles";
import { useMobileLegacyFiguresBundle } from "./useMobileLegacyFigures";
import {
  getMobileLegacyFigureBookRows,
  isMobileLegacyFigurePrimary,
  mobileLegacyFigureEntryHref,
  type MobileLegacyFigureBookRow,
} from "./mobileLegacyFiguresCore";
import { mobileLegacyFigureDisplayName } from "./localizeMobileLegacyFigure";
import { legacyFigureScreenStyles as styles } from "./legacyFigureScreenStyles";

type TableRow =
  | { kind: "testament"; key: string; testament: "old" | "new" }
  | { kind: "book"; key: string; row: MobileLegacyFigureBookRow };

function buildTableRows(bookRows: MobileLegacyFigureBookRow[]): TableRow[] {
  const tableRows: TableRow[] = [];
  let lastTestament: "old" | "new" | null = null;
  for (const row of bookRows) {
    if (row.testament !== lastTestament) {
      tableRows.push({ kind: "testament", key: `testament-${row.testament}`, testament: row.testament });
      lastTestament = row.testament;
    }
    tableRows.push({ kind: "book", key: row.bookId, row });
  }
  return tableRows;
}

export function ExploreLegacyFiguresScreen() {
  const router = useRouter();
  const screenFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const bundle = useMobileLegacyFiguresBundle();
  const [timelineReady, setTimelineReady] = useState(false);
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: 8 + insets.top,
    paddingBottom: shellTabBarScrollPad(insets.bottom),
  });

  const tableRows = useMemo(
    () => buildTableRows(getMobileLegacyFigureBookRows()),
    [bundle.contentVersion],
  );

  useEffect(() => {
    if (!screenFocused) {
      setTimelineReady(false);
      return;
    }
    const task = InteractionManager.runAfterInteractions(() => setTimelineReady(true));
    return () => task.cancel();
  }, [screenFocused]);

  return (
    <ExploreParchmentPage>
      <ParchmentBottomFadeScrollView
        fadePreset={SHELL_TAB_SCROLL_FADE_PRESET}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollContentStyle}
      >
        <Pressable onPress={() => router.back()} style={shared.yearDayCountBackLink} accessibilityRole="button">
          <Text style={shared.backLinkText}>{t("pages.explore.articlesBack")}</Text>
        </Pressable>

        <Text style={styles.pageTitle}>{t("pages.explore.figuresTitle")}</Text>
        <Text style={styles.subtitle}>{t("pages.explore.figuresSubtitle")}</Text>

        <View style={styles.timeline}>
          {timelineReady
            ? tableRows.map((entry, index) => {
            const showLine = index < tableRows.length - 1;
            if (entry.kind === "testament") {
              return (
                <View key={entry.key} style={styles.testamentRow}>
                  <View style={styles.markerCol}>
                    <View style={[styles.dot, styles.dotTestament]} />
                    {showLine ? <View style={styles.line} /> : null}
                  </View>
                  <View style={styles.bodyCol}>
                    <Text style={styles.testamentLabel}>
                      {entry.testament === "old"
                        ? t("pages.read.catalogTestamentOld")
                        : t("pages.read.catalogTestamentNew")}
                    </Text>
                  </View>
                </View>
              );
            }

            return (
              <View key={entry.key} style={styles.bookRow}>
                <View style={styles.markerCol}>
                  <View style={styles.dot} />
                  {showLine ? <View style={styles.line} /> : null}
                </View>
                <View style={styles.bodyCol}>
                  <View style={styles.bookHeading}>
                    <Text style={styles.bookOrder}>{entry.row.bookNumber}</Text>
                    <Text style={styles.bookName}>
                      {getScriptureBookDisplayName(entry.row.bookId, locale)}
                    </Text>
                  </View>
                  {entry.row.eraAria && locale !== "en" ? (
                    <Text style={styles.bookEra}>{localizeZhText(locale, entry.row.eraAria)}</Text>
                  ) : null}
                  <View style={styles.figuresWrap}>
                    {entry.row.figures.map((profile) => {
                      const primary = isMobileLegacyFigurePrimary(profile);
                      const name = mobileLegacyFigureDisplayName(profile, locale);
                      return (
                        <Pressable
                          key={profile.id}
                          onPress={() => router.push(mobileLegacyFigureEntryHref(profile))}
                          style={styles.figureLink}
                          accessibilityRole="button"
                          accessibilityLabel={name}
                        >
                          <Text style={primary ? styles.figureNamePrimary : styles.figureNameSecondary}>
                            {name}
                            {!profile.linkedArticleSlug ? (
                              <Text style={styles.figureFlag}> ·</Text>
                            ) : null}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            );
          })
            : null}
        </View>
      </ParchmentBottomFadeScrollView>
    </ExploreParchmentPage>
  );
}
