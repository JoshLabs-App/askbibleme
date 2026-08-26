import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { Pressable, StyleSheet, View } from "react-native";
import { ExploreText as Text } from "./ExploreText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { t, localizeZhText } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { SHELL_TAB_SCROLL_FADE_PRESET } from "../read/readParchmentScrollMask";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { ShellSystemBackButton } from "../shell/ShellSystemBackButton";
import {exploreStyles as shared, useExploreScrollContentStyle, ExploreParchmentPage} from "./exploreParchmentStyles";
import { loadExploreVerseTextsForRefsProgressive, clearExploreChapterVerseCache, scheduleExploreCategoryVerseLoad } from "./load-explore-category-verses";
import type { ExploreModulesCategory } from "./exploreModulesBundleCore";
import { getExploreModulesContent } from "./exploreModuleContent";
import { useExploreModulesBundle } from "./useExploreModules";

type PraiseWorshipCategory = {
  title: string;
  refs: string[];
};

type ParsedRef = {
  bookId: string;
  chapter: number;
  verseList: number[];
  verseLabel: string;
};

const BOTTOM_PAD = 140;

function parseVerseList(spec: string): number[] {
  const values: number[] = [];
  const parts = spec.split(",").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
        for (let v = start; v <= end; v += 1) values.push(v);
      }
      continue;
    }
    const single = Number(part);
    if (Number.isInteger(single) && single >= 1) values.push(single);
  }
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function parseRef(raw: string): ParsedRef | null {
  const normalized = raw.replace(/\s+/g, " ").trim();
  const m = normalized.match(/^(.+?)\s+(\d+):([0-9,\-]+)$/);
  if (!m) return null;
  const abbr = m[1].trim();
  const chapter = Number(m[2]);
  const verseLabel = m[3].trim();
  const bookId = getExploreModulesContent().praiseWorship.bookAbbrToId[abbr];
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) return null;
  const verseList = parseVerseList(verseLabel);
  if (!verseList.length) return null;
  return { bookId, chapter, verseList, verseLabel };
}

function stripCategoryTitlePrefix(title: string): string {
  return title.replace(/^\s*\d+\s*\.\s*/, "").trim();
}

export function ExplorePraiseWorshipScreen() {
  const modules = useExploreModulesBundle();
  const praiseWorshipCategories: ExploreModulesCategory[] = modules.praiseWorship.categories;
  const praiseWorshipTitlesEn = modules.praiseWorship.titlesEn;
  const router = useRouter();
  const screenFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: 8 + insets.top,
    paddingBottom: BOTTOM_PAD + insets.bottom,
  });
  const { locale } = useLocale();
  const [verseTextByRef, setVerseTextByRef] = useState<Record<string, string>>({});
  const [expandedCategoryIndex, setExpandedCategoryIndex] = useState<number | null>(null);
  const categoryTitles = locale === "en" ? praiseWorshipTitlesEn : null;

  const parsedRefByRaw = useMemo(() => {
    const entries = praiseWorshipCategories.flatMap((category) => category.refs).map((raw) => [
      raw,
      parseRef(raw),
    ] as const);
    return Object.fromEntries(entries) as Record<string, ParsedRef | null>;
  }, [praiseWorshipCategories]);

  useEffect(() => {
    clearExploreChapterVerseCache();
    setVerseTextByRef({});
    setExpandedCategoryIndex(null);
  }, [locale]);

  useEffect(() => {
    if (!screenFocused || expandedCategoryIndex === null) return;
    const category = praiseWorshipCategories[expandedCategoryIndex];
    if (!category) return;

    let cancelled = false;
    const task = scheduleExploreCategoryVerseLoad(() => {
      void (async () => {
        const unavailable =
          locale === "en" ? "Verse unavailable." : t("pages.explore.prayerScriptureUnavailable");
        await loadExploreVerseTextsForRefsProgressive(
          category.refs,
          parsedRefByRaw,
          locale,
          unavailable,
          (partial) => {
            if (cancelled || !screenFocused) return;
            setVerseTextByRef((prev) => {
              const merged = { ...prev };
              let changed = false;
              for (const [ref, text] of Object.entries(partial)) {
                if (merged[ref] == null) {
                  merged[ref] = text;
                  changed = true;
                }
              }
              return changed ? merged : prev;
            });
          },
        );
      })();
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [expandedCategoryIndex, locale, parsedRefByRaw, screenFocused]);

  return (
    <ExploreParchmentPage>
      <ParchmentBottomFadeScrollView
        fadePreset={SHELL_TAB_SCROLL_FADE_PRESET}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollContentStyle}
      >
        <ShellSystemBackButton onPress={() => router.back()} />

        <Text style={styles.pageTitle}>{t("pages.explore.praiseWorshipTitle")}</Text>
        <Text style={styles.eyebrow}>{t("pages.explore.praiseWorshipSubtitle")}</Text>

        <View style={styles.accordionList}>
          {praiseWorshipCategories.map((category, index) => (
            <View key={category.title} style={styles.accordionItem}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setExpandedCategoryIndex((current) => (current === index ? null : index));
                }}
                style={({ pressed }) => [styles.accordionHeader, pressed && styles.accordionHeaderPressed]}
              >
                <View style={styles.headerTextWrap}>
                  <Text style={styles.sectionIndexText}>{String(index + 1)}.</Text>
                  <Text style={styles.sectionTitle}>
                    {stripCategoryTitlePrefix(
                      categoryTitles?.[index] ?? localizeZhText(locale, category.title),
                    )}
                  </Text>
                </View>
                <Text style={styles.sectionChevron}>{expandedCategoryIndex === index ? "−" : "+"}</Text>
              </Pressable>
              {expandedCategoryIndex === index ? (
                <View style={styles.verseList}>
                  {category.refs.map((ref) => (
                    <View key={`${category.title}-${ref}`} style={styles.verseItem}>
                      <Text style={styles.verseText}>
                        {verseTextByRef[ref] ??
                          (locale === "en"
                            ? "Loading verse..."
                            : t("pages.explore.prayerScriptureLoading"))}
                      </Text>
                      <Text style={styles.verseRefLine}>
                        —{" "}
                        {(() => {
                          const parsed = parsedRefByRaw[ref];
                          if (!parsed) return ref;
                          return `${getScriptureBookDisplayName(parsed.bookId, locale)} ${parsed.chapter}:${parsed.verseLabel}`;
                        })()}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ParchmentBottomFadeScrollView>
    </ExploreParchmentPage>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0.1,
    ...parchmentSans(500),
    color: c.inkSoft,
    textAlign: "center",
  },
  pageTitle: {
    marginTop: 10,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.45,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  accordionList: {
    marginTop: 18,
    gap: 10,
  },
  accordionItem: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: c.chapterCellBorder,
    backgroundColor: c.chapterCell,
    overflow: "hidden",
  },
  accordionHeader: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  accordionHeaderPressed: {
    backgroundColor: c.hover,
  },
  headerTextWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  sectionIndexText: {
    fontSize: 16,
    lineHeight: 22,
    ...parchmentSans(700),
    color: c.parchmentAccent,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    lineHeight: 24,
    ...parchmentSans(700),
    color: c.parchmentAccent,
  },
  sectionChevron: {
    fontSize: 22,
    lineHeight: 24,
    ...parchmentSans(700),
    color: c.parchmentAccent,
    width: 18,
    textAlign: "center",
  },
  verseList: {
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
  },
  verseItem: {
    gap: 2,
  },
  verseRefLine: {
    fontSize: 12,
    lineHeight: 18,
    ...parchmentSans(600),
    color: c.faint,
    textAlign: "right",
  },
  verseText: {
    fontSize: 16,
    lineHeight: 24,
    ...parchmentSans(500),
    color: c.inkSoft,
    textAlign: "left",
  },
});
