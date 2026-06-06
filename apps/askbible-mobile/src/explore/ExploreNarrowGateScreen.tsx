import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { DEFAULT_SCRIPTURE_TRANSLATION_ID } from "../bible/types";
import { parchmentSans } from "../fonts/parchmentType";
import type { AppLocale } from "../i18n/config";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { exploreStyles as shared } from "./exploreParchmentStyles";

type NarrowGateCategory = {
  title: string;
  refs: string[];
};

type ParsedRef = {
  bookId: string;
  chapter: number;
  verseList: number[];
  verseLabel: string;
};

export const NARROW_GATE_BOOK_ABBR_TO_ID: Record<string, string> = {
  创: "GEN",
  申: "DEU",
  利: "LEV",
  诗: "PSA",
  箴: "PRO",
  太: "MAT",
  可: "MRK",
  路: "LUK",
  约: "JHN",
  徒: "ACT",
  罗: "ROM",
  林前: "1CO",
  林后: "2CO",
  加: "GAL",
  弗: "EPH",
  腓: "PHP",
  西: "COL",
  帖前: "1TH",
  提前: "1TI",
  提后: "2TI",
  多: "TIT",
  来: "HEB",
  雅: "JAS",
  彼前: "1PE",
  彼后: "2PE",
  约壹: "1JN",
  启: "REV",
  弥: "MIC",
};

export const NARROW_GATE_CATEGORIES: NarrowGateCategory[] = [
  { title: "1. 得救与根基", refs: ["可 1:15", "徒 2:38", "约 3:3", "罗 10:9-10", "弗 2:8-10", "太 28:19"] },
  { title: "2. 爱神爱人", refs: ["太 22:37-39", "约 13:34-35", "罗 13:8-10", "加 5:14"] },
  { title: "3. 跟随主与门徒代价", refs: ["路 9:23", "路 14:26-27", "太 6:33", "约 15:4-5", "约 14:15"] },
  { title: "4. 圣洁与分别为圣", refs: ["彼前 1:15-16", "来 12:14", "罗 12:2", "西 3:5", "林前 6:19-20"] },
  { title: "5. 品格与圣灵果子", refs: ["加 5:22-23", "弗 4:1-3", "西 3:12-14", "帖前 5:16-18", "腓 4:6-7"] },
  { title: "6. 祷告与神话语", refs: ["帖前 5:17", "路 18:1", "提后 3:16-17", "雅 1:22", "西 3:16", "约壹 5:14-15"] },
  { title: "7. 教会生活", refs: ["来 10:24-25", "加 6:2", "弗 4:32", "罗 15:7", "彼前 4:10-11", "来 13:17"] },
  { title: "8. 家庭与婚姻", refs: ["弗 5:22-25", "弗 6:1-4", "来 13:4", "彼前 3:1-2"] },
  { title: "9. 金钱与工作", refs: ["提前 6:6-10", "来 13:5", "西 3:23-24", "林后 9:6-8", "约壹 2:15-17"] },
  { title: "10. 见证与使命", refs: ["太 28:19-20", "太 5:13-16", "徒 1:8", "彼前 3:15", "提后 4:2"] },
  { title: "11. 受苦与忍耐", refs: ["太 5:10-12", "罗 5:3-5", "雅 1:12", "彼前 3:14", "来 12:1-3"] },
  { title: "12. 警醒与永恒盼望", refs: ["太 24:42-44", "彼后 3:11-14", "约 11:25-26", "启 2:10", "启 21:1-4"] },
];

const NARROW_GATE_TITLES_EN: string[] = [
  "1. Salvation and foundation",
  "2. Love God and love people",
  "3. Follow Christ and the cost",
  "4. Holiness and being set apart",
  "5. Character and fruit of the Spirit",
  "6. Prayer and God's word",
  "7. Church life",
  "8. Family and marriage",
  "9. Money and vocation",
  "10. Witness and mission",
  "11. Suffering and endurance",
  "12. Watchfulness and eternal hope",
];

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
  const bookId = NARROW_GATE_BOOK_ABBR_TO_ID[abbr];
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) return null;
  const verseList = parseVerseList(verseLabel);
  if (!verseList.length) return null;
  return { bookId, chapter, verseList, verseLabel };
}

function translationIdForLocale(locale: AppLocale): string {
  return locale === "en" ? "web-en" : DEFAULT_SCRIPTURE_TRANSLATION_ID;
}

function verseTextForParsedRef(
  chapterText: { verse: number; text: string }[],
  ref: ParsedRef,
): string | null {
  const byVerse = new Map<number, string>();
  for (const row of chapterText) byVerse.set(row.verse, row.text);
  const parts = ref.verseList.map((v) => byVerse.get(v)?.trim() ?? "").filter(Boolean);
  if (!parts.length) return null;
  const hasHan = parts.some((line) => /[\p{Script=Han}]/u.test(line));
  return parts.join(hasHan ? "" : " ");
}

function stripCategoryTitlePrefix(title: string): string {
  return title.replace(/^\s*\d+\s*\.\s*/, "").trim();
}

export function ExploreNarrowGateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const [verseTextByRef, setVerseTextByRef] = useState<Record<string, string>>({});
  const [expandedCategoryIndex, setExpandedCategoryIndex] = useState<number | null>(null);
  const categoryTitles = locale === "en" ? NARROW_GATE_TITLES_EN : null;

  const parsedRefByRaw = useMemo(() => {
    const entries = NARROW_GATE_CATEGORIES.flatMap((category) => category.refs).map((raw) => [
      raw,
      parseRef(raw),
    ] as const);
    return Object.fromEntries(entries) as Record<string, ParsedRef | null>;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const translationId = translationIdForLocale(locale);
      const chapterCache = new Map<string, Awaited<ReturnType<typeof loadChapterFromBundledTranslation>>>();
      const uniqueChapters = Array.from(
        new Set(
          Object.values(parsedRefByRaw)
            .filter((row): row is ParsedRef => row != null)
            .map((row) => `${row.bookId}:${row.chapter}`),
        ),
      );
      await Promise.all(
        uniqueChapters.map(async (chapterKey) => {
          const [bookId, chapterRaw] = chapterKey.split(":");
          try {
            const loaded = await loadChapterFromBundledTranslation(
              bookId,
              Number(chapterRaw),
              translationId,
            );
            chapterCache.set(chapterKey, loaded);
          } catch {
            chapterCache.set(chapterKey, null);
          }
        }),
      );
      const next: Record<string, string> = {};
      for (const raw of Object.keys(parsedRefByRaw)) {
        const parsed = parsedRefByRaw[raw];
        if (!parsed) {
          next[raw] = locale === "en" ? "Verse unavailable." : "经文正文暂缺";
          continue;
        }
        const chapterKey = `${parsed.bookId}:${parsed.chapter}`;
        const loaded = chapterCache.get(chapterKey);
        const resolved = loaded ? verseTextForParsedRef(loaded.verses, parsed) : null;
        next[raw] = resolved ?? (locale === "en" ? "Verse unavailable." : "经文正文暂缺");
      }
      if (!cancelled) setVerseTextByRef(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, parsedRefByRaw]);

  return (
    <View style={shared.root}>
      <ParchmentBottomFadeScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          shared.scroll,
          {
            paddingTop: 8 + insets.top,
            paddingBottom: BOTTOM_PAD + insets.bottom,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={shared.yearDayCountBackLink} accessibilityRole="button">
          <Text style={shared.backLinkText}>{t("pages.explore.narrowGateBack")}</Text>
        </Pressable>

        <Text style={styles.pageTitle}>{t("pages.explore.narrowGateTitle")}</Text>
        <Text style={styles.eyebrow}>{t("pages.explore.narrowGateSubtitle")}</Text>

        <View style={styles.accordionList}>
          {NARROW_GATE_CATEGORIES.map((category, index) => (
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
                    {stripCategoryTitlePrefix(categoryTitles?.[index] ?? category.title)}
                  </Text>
                </View>
                <Text style={styles.sectionChevron}>{expandedCategoryIndex === index ? "−" : "+"}</Text>
              </Pressable>
              {expandedCategoryIndex === index ? (
                <View style={styles.verseList}>
                  {category.refs.map((ref) => (
                    <View key={`${category.title}-${ref}`} style={styles.verseItem}>
                      <Text style={styles.verseText}>
                        {verseTextByRef[ref] ?? (locale === "en" ? "Loading verse..." : "经文加载中…")}
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
    </View>
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
