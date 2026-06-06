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

type WordOfGodCategory = {
  title: string;
  refs: string[];
};
type ParsedWordOfGodRef = {
  raw: string;
  bookId: string;
  chapter: number;
  verseList: number[];
  verseLabel: string;
};

export const WORD_OF_GOD_BOOK_ABBR_TO_ID: Record<string, string> = {
  创: "GEN",
  申: "DEU",
  书: "JOS",
  撒下: "2SA",
  王上: "1KI",
  诗: "PSA",
  箴: "PRO",
  传: "ECC",
  赛: "ISA",
  耶: "JER",
  亚: "ZEC",
  太: "MAT",
  可: "MRK",
  路: "LUK",
  约: "JHN",
  徒: "ACT",
  罗: "ROM",
  林前: "1CO",
  林后: "2CO",
  弗: "EPH",
  西: "COL",
  帖前: "1TH",
  提后: "2TI",
  来: "HEB",
  雅: "JAS",
  彼前: "1PE",
  彼后: "2PE",
  犹: "JUD",
  启: "REV",
};

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

function parseWordOfGodRef(raw: string): ParsedWordOfGodRef | null {
  const normalized = raw.replace(/\s+/g, " ").trim();
  const m = normalized.match(/^(.+?)\s+(\d+):([0-9,\-]+)$/);
  if (!m) return null;
  const abbr = m[1].trim();
  const chapter = Number(m[2]);
  const verseLabel = m[3].trim();
  const bookId = WORD_OF_GOD_BOOK_ABBR_TO_ID[abbr];
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) return null;
  const verseList = parseVerseList(verseLabel);
  if (!verseList.length) return null;
  return { raw: normalized, bookId, chapter, verseList, verseLabel };
}

function translationIdForLocale(locale: AppLocale): string {
  return locale === "en" ? "web-en" : DEFAULT_SCRIPTURE_TRANSLATION_ID;
}

function verseTextForParsedRef(chapterText: { verse: number; text: string }[], ref: ParsedWordOfGodRef): string | null {
  const byVerse = new Map<number, string>();
  for (const row of chapterText) byVerse.set(row.verse, row.text);
  const parts = ref.verseList
    .map((v) => byVerse.get(v)?.trim() ?? "")
    .filter(Boolean);
  if (!parts.length) return null;
  const hasHan = parts.some((line) => /[\p{Script=Han}]/u.test(line));
  return parts.join(hasHan ? "" : " ");
}

function stripCategoryTitlePrefix(title: string): string {
  return title.replace(/^\s*\d+\s*\.\s*/, "").trim();
}

export const WORD_OF_GOD_CATEGORIES: WordOfGodCategory[] = [
  { title: "1. 神的话从神而来", refs: ["提后 3:16-17", "彼后 1:20-21", "帖前 2:13", "来 1:1-2", "亚 7:12"] },
  { title: "2. 神的话是真理", refs: ["约 17:17", "诗 119:160", "诗 119:142", "诗 119:151", "约 10:35"] },
  { title: "3. 神的话永远长存", refs: ["赛 40:8", "太 24:35", "彼前 1:24-25", "诗 119:89", "诗 119:152"] },
  { title: "4. 神的话有能力", refs: ["来 4:12", "耶 23:29", "赛 55:10-11", "路 1:37"] },
  { title: "5. 神的话创造万有", refs: ["创 1:3", "诗 33:6", "诗 33:9", "来 11:3", "彼后 3:5"] },
  { title: "6. 神的话赐生命", refs: ["约 6:63", "太 4:4", "申 8:3", "彼前 1:23", "雅 1:18"] },
  { title: "7. 神的话使人得救", refs: ["罗 10:17", "雅 1:21", "约 20:31", "提后 3:15", "徒 11:14"] },
  { title: "8. 神的话使人成圣、洁净", refs: ["约 17:17", "约 15:3", "弗 5:26", "诗 119:9", "彼前 1:22"] },
  { title: "9. 神的话光照、引导人", refs: ["诗 119:105", "诗 119:130", "箴 6:23", "诗 19:8", "彼后 1:19"] },
  { title: "10. 神的话赐智慧", refs: ["诗 19:7", "诗 119:98-100", "提后 3:15", "箴 2:6", "西 3:16"] },
  { title: "11. 神的话使人归正、受教", refs: ["提后 3:16", "诗 19:7", "诗 119:11", "诗 119:67", "诗 119:71"] },
  { title: "12. 神的话是属灵粮食", refs: ["太 4:4", "耶 15:16", "彼前 2:2", "来 5:12-14", "林前 3:2"] },
  { title: "13. 神的话是兵器", refs: ["弗 6:17", "来 4:12", "太 4:4,7,10", "启 19:15", "林后 10:4-5"] },
  { title: "14. 神的话带来盼望和安慰", refs: ["罗 15:4", "诗 119:49-50", "诗 119:81", "诗 119:114", "帖前 4:18"] },
  { title: "15. 神的话带来喜乐", refs: ["诗 119:103", "耶 15:16", "诗 19:8", "诗 119:111", "诗 119:162"] },
  {
    title: "16. 神的话是纯净、炼净的",
    refs: ["诗 12:6", "诗 18:30", "箴 30:5", "诗 119:140", "撒下 22:31"],
  },
  { title: "17. 神的话是完全的", refs: ["诗 19:7", "诗 18:30", "申 32:4", "诗 119:96", "雅 1:25"] },
  { title: "18. 神的话不可增减", refs: ["申 4:2", "申 12:32", "箴 30:6", "启 22:18-19"] },
  { title: "19. 神的话要存在心里", refs: ["诗 119:11", "申 6:6-7", "西 3:16", "申 30:14", "诗 37:31"] },
  { title: "20. 神的话要被思想默想", refs: ["书 1:8", "诗 1:2", "诗 119:97", "诗 119:148", "诗 119:15"] },
  { title: "21. 神的话要被遵行", refs: ["雅 1:22", "路 11:28", "太 7:24", "约 14:21", "约 14:23"] },
  { title: "22. 神的话要被传扬", refs: ["提后 4:2", "可 16:15", "罗 10:14-15", "徒 6:7", "徒 12:24"] },
  { title: "23. 神的话不能被捆绑", refs: ["提后 2:9", "徒 19:20", "徒 13:49"] },
  { title: "24. 神的话会审判人", refs: ["约 12:48", "来 4:12-13", "罗 2:16", "启 20:12"] },
  { title: "25. 神的话为基督作见证", refs: ["约 5:39", "路 24:27", "路 24:44-45", "约 1:1", "约 1:14"] },
  { title: "26. 神的话应验、不落空", refs: ["书 21:45", "书 23:14", "王上 8:56", "太 5:18", "路 21:33"] },
  { title: "27. 神的话使人自由", refs: ["约 8:31-32", "雅 1:25", "诗 119:45"] },
  { title: "28. 神的话建立人", refs: ["徒 20:32", "犹 1:20", "西 2:6-7"] },
  { title: "29. 神的话带来信心", refs: ["罗 10:17", "约 4:41", "徒 4:4", "徒 18:8"] },
  { title: "30. 神的话揭露人心", refs: ["来 4:12", "徒 2:37", "林前 14:24-25"] },
  {
    title: "特别推荐：诗篇 119",
    refs: [
      "诗 119:9",
      "诗 119:11",
      "诗 119:18",
      "诗 119:24",
      "诗 119:28",
      "诗 119:50",
      "诗 119:67",
      "诗 119:72",
      "诗 119:89",
      "诗 119:97",
      "诗 119:103",
      "诗 119:105",
      "诗 119:111",
      "诗 119:130",
      "诗 119:140",
      "诗 119:160",
      "诗 119:162",
      "诗 119:165",
    ],
  },
];

const WORD_OF_GOD_CATEGORY_TITLES_EN: string[] = [
  "1. God's word comes from God",
  "2. God's word is truth",
  "3. God's word endures forever",
  "4. God's word has power",
  "5. God's word creates all things",
  "6. God's word gives life",
  "7. God's word brings salvation",
  "8. God's word sanctifies and cleanses",
  "9. God's word gives light and guidance",
  "10. God's word gives wisdom",
  "11. God's word corrects and teaches",
  "12. God's word is spiritual food",
  "13. God's word is a weapon",
  "14. God's word gives hope and comfort",
  "15. God's word brings joy",
  "16. God's word is pure and refined",
  "17. God's word is perfect",
  "18. God's word must not be added or removed",
  "19. God's word should be hidden in the heart",
  "20. God's word should be meditated on",
  "21. God's word should be obeyed",
  "22. God's word should be proclaimed",
  "23. God's word cannot be bound",
  "24. God's word will judge people",
  "25. God's word testifies of Christ",
  "26. God's word is fulfilled and never fails",
  "27. God's word makes people free",
  "28. God's word builds people up",
  "29. God's word brings faith",
  "30. God's word exposes the heart",
  "Special: Psalm 119",
];

const WORD_OF_GOD_BOTTOM_PAD = 140;

export function ExploreWordOfGodScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const [verseTextByRef, setVerseTextByRef] = useState<Record<string, string>>({});
  const [expandedCategoryIndex, setExpandedCategoryIndex] = useState<number | null>(null);
  const categoryTitles = locale === "en" ? WORD_OF_GOD_CATEGORY_TITLES_EN : null;

  const parsedRefByRaw = useMemo(() => {
    const entries = WORD_OF_GOD_CATEGORIES.flatMap((category) => category.refs).map((raw) => [
      raw,
      parseWordOfGodRef(raw),
    ] as const);
    return Object.fromEntries(entries) as Record<string, ParsedWordOfGodRef | null>;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const translationId = translationIdForLocale(locale);
      const chapterCache = new Map<
        string,
        Awaited<ReturnType<typeof loadChapterFromBundledTranslation>>
      >();
      const uniqueChapters = Array.from(
        new Set(
          Object.values(parsedRefByRaw)
            .filter((row): row is ParsedWordOfGodRef => row != null)
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
        const resolved = loaded
          ? verseTextForParsedRef(loaded.verses, parsed)
          : null;
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
            paddingBottom: WORD_OF_GOD_BOTTOM_PAD + insets.bottom,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={shared.yearDayCountBackLink} accessibilityRole="button">
          <Text style={shared.backLinkText}>{t("pages.explore.wordOfGodBack")}</Text>
        </Pressable>

        <Text style={styles.pageTitle}>{t("pages.explore.wordOfGodTitle")}</Text>
        <Text style={styles.eyebrow}>{t("pages.explore.wordOfGodSubtitle")}</Text>

        <View style={styles.accordionList}>
          {WORD_OF_GOD_CATEGORIES.map((category, index) => (
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
