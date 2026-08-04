import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { t, localizeZhText } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { SHELL_TAB_SCROLL_FADE_PRESET } from "../read/readParchmentScrollMask";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import {
  exploreStyles as shared,
  useExploreScrollContentStyle,
  ExploreParchmentPage,
} from "./exploreParchmentStyles";
import { loadExploreVerseTextsForRefsProgressive, clearExploreChapterVerseCache, scheduleExploreCategoryVerseLoad } from "./load-explore-category-verses";
import type { ExploreModulesPrayerScenario } from "./exploreModulesBundleCore";
import { getExploreModulesContent } from "./exploreModuleContent";
import { useExploreModulesBundle } from "./useExploreModules";

type PrayerScenario = {
  title: string;
  titleTw: string;
  titleEn: string;
  refs: string[];
};

export function resolvePrayerScenarioTitle(scenario: PrayerScenario, locale: string): string {
  if (locale === "en") return scenario.titleEn;
  if (locale === "zh-TW") return scenario.titleTw;
  return scenario.title;
}

type ParsedRef = {
  bookId: string;
  chapter: number;
  verseList: number[];
  verseLabel: string;
};


const BOTTOM_PAD = 138;

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
  const bookId = getExploreModulesContent().prayer.bookAbbrToId[abbr];
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) return null;
  const verseList = parseVerseList(verseLabel);
  if (!verseList.length) return null;
  return { bookId, chapter, verseList, verseLabel };
}

export function ExplorePrayerScriptureScreen() {
  const modules = useExploreModulesBundle();
  const prayerScenarios: ExploreModulesPrayerScenario[] = modules.prayer.scenarios;
  const router = useRouter();
  const screenFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: 8 + insets.top,
    paddingBottom: BOTTOM_PAD + insets.bottom,
  });
  const { locale } = useLocale();
  const [verseTextByRef, setVerseTextByRef] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const parsedRefByRaw = useMemo(() => {
    const entries = prayerScenarios
      .flatMap((category) => category.refs)
      .map((raw) => [raw, parseRef(raw)] as const);
    return Object.fromEntries(entries) as Record<string, ParsedRef | null>;
  }, [prayerScenarios]);

  useEffect(() => {
    clearExploreChapterVerseCache();
    setVerseTextByRef({});
    setExpanded({});
  }, [locale]);

  useEffect(() => {
    if (!screenFocused) return;
    const openIndices = Object.entries(expanded)
      .filter(([, isOpen]) => isOpen)
      .map(([index]) => Number(index));
    if (openIndices.length === 0) return;

    const refsToLoad = openIndices.flatMap((index) => {
      const scenario = prayerScenarios[index];
      return scenario?.refs ?? [];
    });
    if (refsToLoad.length === 0) return;

    let cancelled = false;
    const task = scheduleExploreCategoryVerseLoad(() => {
      void (async () => {
        await loadExploreVerseTextsForRefsProgressive(
          refsToLoad,
          parsedRefByRaw,
          locale,
          t("pages.explore.prayerScriptureUnavailable"),
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
  }, [expanded, locale, parsedRefByRaw, screenFocused]);

  return (
    <ExploreParchmentPage>
      <ParchmentBottomFadeScrollView
        fadePreset={SHELL_TAB_SCROLL_FADE_PRESET}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollContentStyle}
      >
        <Pressable onPress={() => router.back()} style={shared.yearDayCountBackLink} accessibilityRole="button">
          <Text style={shared.backLinkText}>{t("pages.explore.prayerScriptureBack")}</Text>
        </Pressable>

        <Text style={styles.pageTitle}>{t("pages.explore.prayerScriptureTitle")}</Text>
        <Text style={styles.subtitle}>{t("pages.explore.prayerScriptureSubtitle")}</Text>
        <Text style={styles.tapHint}>{t("pages.explore.prayerScriptureTapHint")}</Text>

        <View style={styles.listWrap}>
          {prayerScenarios.map((scenario, index) => {
            const isOpen = !!expanded[index];
            const title = resolvePrayerScenarioTitle(scenario, locale);
            return (
              <View key={scenario.title} style={styles.card}>
                <Pressable
                  style={({ pressed }) => [styles.cardHead, pressed && styles.cardHeadPressed]}
                  onPress={() => setExpanded((prev) => ({ ...prev, [index]: !isOpen }))}
                  accessibilityRole="button"
                  accessibilityLabel={title}
                >
                  <Text style={styles.cardTitle}>{title}</Text>
                  <Text style={styles.cardMeta}>
                    {scenario.refs.length}
                    {locale === "en" ? " verses" : localizeZhText(locale, " 节")}
                    {isOpen
                      ? locale === "en"
                        ? " · Hide"
                        : localizeZhText(locale, " · 收起")
                      : locale === "en"
                        ? " · Show"
                        : localizeZhText(locale, " · 展开")}
                  </Text>
                </Pressable>

                {isOpen ? (
                  <View style={styles.verseList}>
                    {scenario.refs.map((ref) => (
                      <View key={`${scenario.title}-${ref}`} style={styles.verseItem}>
                        <Text style={styles.verseText}>{verseTextByRef[ref] ?? t("pages.explore.prayerScriptureLoading")}</Text>
                        <Text style={styles.verseRef}>
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
            );
          })}
        </View>
      </ParchmentBottomFadeScrollView>
    </ExploreParchmentPage>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    marginTop: 10,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.45,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.08,
    ...parchmentSans(500),
    color: c.inkSoft,
    textAlign: "center",
  },
  tapHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    ...parchmentSans(500),
    color: c.faint,
    textAlign: "center",
  },
  listWrap: {
    marginTop: 18,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.58)",
    overflow: "hidden",
  },
  cardHead: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  cardHeadPressed: {
    opacity: 0.86,
  },
  cardTitle: {
    fontSize: 19,
    lineHeight: 27,
    ...parchmentSans(700),
    color: c.ink,
  },
  cardMeta: {
    fontSize: 12,
    lineHeight: 16,
    ...parchmentSans(500),
    color: c.faint,
  },
  verseList: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 12,
  },
  verseItem: {
    gap: 2,
  },
  verseText: {
    fontSize: 16,
    lineHeight: 24,
    ...parchmentSans(500),
    color: c.inkSoft,
    textAlign: "left",
  },
  verseRef: {
    fontSize: 12,
    lineHeight: 18,
    ...parchmentSans(600),
    color: c.faint,
    textAlign: "right",
  },
});
