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

export const PRAISE_WORSHIP_BOOK_ABBR_TO_ID: Record<string, string> = {
  出: "EXO",
  民: "NUM",
  申: "DEU",
  诗: "PSA",
  赛: "ISA",
  耶: "JER",
  约: "JHN",
  罗: "ROM",
  提前: "1TI",
  提后: "2TI",
  来: "HEB",
  雅: "JAS",
  彼前: "1PE",
  约壹: "1JN",
  启: "REV",
};

export const PRAISE_WORSHIP_CATEGORIES: PraiseWorshipCategory[] = [
  {
    title: "1. 看见神的圣洁，发出敬拜",
    refs: [
      "赛 6:3",
      "诗 99:5",
      "诗 99:9",
      "彼前 1:15-16",
      "诗 96:9",
      "诗 29:2",
      "诗 24:3-4",
      "诗 93:5",
      "诗 111:9",
      "诗 145:17",
      "启 15:4",
    ],
  },
  {
    title: "2. 看见神的慈爱怜悯，发出赞美",
    refs: [
      "出 34:6",
      "诗 103:8",
      "诗 145:8-9",
      "诗 107:1",
      "诗 136:1",
      "诗 136:2",
      "诗 136:3",
      "诗 136:26",
      "诗 100:5",
      "诗 118:1",
      "诗 89:1",
      "罗 2:4",
      "约壹 4:9-10",
    ],
  },
  {
    title: "3. 看见神的全能主权，心被提升",
    refs: [
      "耶 32:17",
      "启 1:8",
      "赛 40:28",
      "诗 147:5",
      "诗 46:10",
      "诗 47:7-8",
      "诗 93:1-2",
      "诗 115:3",
      "诗 135:6",
      "诗 145:3",
      "提前 6:15-16",
      "启 19:6",
      "启 11:17",
    ],
  },
  {
    title: "4. 看见神的公义信实，心生敬畏",
    refs: [
      "申 32:4",
      "民 23:19",
      "罗 3:25-26",
      "提后 2:13",
      "诗 33:4",
      "诗 89:14",
      "诗 111:7-8",
      "诗 119:137-138",
      "诗 145:17",
      "诗 146:6",
      "雅 1:17",
      "约壹 1:5",
    ],
  },
  {
    title: "5. 人向神献上赞美与称颂",
    refs: [
      "诗 95:1-2",
      "诗 96:1-4",
      "诗 100:1-2",
      "诗 103:1-2",
      "诗 103:20-22",
      "诗 104:33",
      "诗 105:1-2",
      "诗 106:1",
      "诗 107:8",
      "诗 111:1",
      "诗 113:1-3",
      "诗 117:1-2",
      "诗 150:1-2",
      "诗 150:6",
    ],
  },
  {
    title: "6. 以敬拜回应神的爱与救恩",
    refs: [
      "约 3:16",
      "约壹 4:8-10",
      "约 4:24",
      "罗 12:1",
      "诗 40:3",
      "诗 66:1-2",
      "诗 68:19-20",
      "诗 71:23",
      "诗 98:1",
      "诗 116:1-2",
      "诗 116:12-14",
      "来 13:15",
      "彼前 2:9",
      "启 5:12-13",
    ],
  },
  {
    title: "7. 万民都当来到神面前敬拜",
    refs: [
      "诗 86:9",
      "诗 22:27",
      "诗 66:8",
      "启 7:11-12",
      "诗 47:1",
      "诗 67:3-5",
      "诗 72:18-19",
      "诗 96:7-8",
      "诗 97:6",
      "诗 98:4",
      "诗 117:1",
      "启 15:3-4",
      "启 19:1",
      "启 19:7",
    ],
  },
  {
    title: "8. 在日常与患难中继续赞美",
    refs: [
      "诗 34:1",
      "诗 30:12",
      "来 13:15",
      "彼前 2:9",
      "诗 42:11",
      "诗 43:5",
      "诗 57:7-9",
      "诗 59:16-17",
      "诗 63:3-4",
      "诗 71:14",
      "诗 92:1-2",
      "诗 119:164",
      "雅 1:2-3",
      "罗 5:3-5",
    ],
  },
];

const PRAISE_WORSHIP_TITLES_EN: string[] = [
  "1. Worship in response to God's holiness",
  "2. Praise in response to God's mercy and love",
  "3. Worship in light of God's power and sovereignty",
  "4. Reverence for God's righteousness and faithfulness",
  "5. Human praise and thanksgiving to God",
  "6. Worship responding to God's love and salvation",
  "7. All peoples are called to worship God",
  "8. Keep praising in daily life and trials",
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
  const bookId = PRAISE_WORSHIP_BOOK_ABBR_TO_ID[abbr];
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) return null;
  const verseList = parseVerseList(verseLabel);
  if (!verseList.length) return null;
  return { bookId, chapter, verseList, verseLabel };
}

function translationIdForLocale(locale: AppLocale): string {
  return locale === "en" ? "web-en" : DEFAULT_SCRIPTURE_TRANSLATION_ID;
}

function verseTextForParsedRef(chapterText: { verse: number; text: string }[], ref: ParsedRef): string | null {
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

export function ExplorePraiseWorshipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const [verseTextByRef, setVerseTextByRef] = useState<Record<string, string>>({});
  const [expandedCategoryIndex, setExpandedCategoryIndex] = useState<number | null>(null);
  const categoryTitles = locale === "en" ? PRAISE_WORSHIP_TITLES_EN : null;

  const parsedRefByRaw = useMemo(() => {
    const entries = PRAISE_WORSHIP_CATEGORIES.flatMap((category) => category.refs).map((raw) => [
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
          <Text style={shared.backLinkText}>{t("pages.explore.praiseWorshipBack")}</Text>
        </Pressable>

        <Text style={styles.pageTitle}>{t("pages.explore.praiseWorshipTitle")}</Text>
        <Text style={styles.eyebrow}>{t("pages.explore.praiseWorshipSubtitle")}</Text>

        <View style={styles.accordionList}>
          {PRAISE_WORSHIP_CATEGORIES.map((category, index) => (
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
