import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { DEFAULT_SCRIPTURE_TRANSLATION_ID } from "../bible/types";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { exploreStyles as shared } from "./exploreParchmentStyles";

type RestRestoreCategory = {
  title: string;
  refs: string[];
};

type ParsedRef = {
  bookId: string;
  chapter: number;
  verseList: number[];
  verseLabel: string;
};

export const REST_RESTORE_BOOK_ABBR_TO_ID: Record<string, string> = {
  诗: "PSA",
  箴: "PRO",
  赛: "ISA",
  耶: "JER",
  哀: "LAM",
  何: "HOS",
  弥: "MIC",
  哈: "HAB",
  太: "MAT",
  可: "MRK",
  路: "LUK",
  约: "JHN",
  罗: "ROM",
  林前: "1CO",
  林后: "2CO",
  弗: "EPH",
  腓: "PHP",
  西: "COL",
  帖前: "1TH",
  提后: "2TI",
  来: "HEB",
  雅: "JAS",
  彼前: "1PE",
  约壹: "1JN",
  犹: "JUD",
  启: "REV",
};

export const REST_RESTORE_CATEGORIES: RestRestoreCategory[] = [
  {
    title: "1. 疲惫时，先回到神面前",
    refs: ["诗 23:1-3", "诗 42:11", "诗 46:1", "诗 55:22", "诗 62:1-2", "诗 62:5-8", "诗 91:1-2", "诗 121:1-2", "太 11:28-30", "彼前 5:7"],
  },
  {
    title: "2. 软弱中，神使人重新得力",
    refs: ["诗 27:1", "诗 28:7", "诗 29:11", "诗 73:26", "诗 84:5", "诗 84:7", "赛 40:29-31", "赛 41:10", "赛 43:1-2", "林后 12:9"],
  },
  {
    title: "3. 忧虑不安时，神赐平安与安慰",
    refs: ["诗 4:8", "诗 34:4", "诗 34:17-18", "诗 94:19", "诗 119:50", "赛 26:3", "约 14:27", "约 16:33", "腓 4:6-7", "林后 1:3-4"],
  },
  {
    title: "4. 受伤与破碎时，神医治并裹伤",
    refs: ["诗 6:2", "诗 30:2", "诗 103:2-5", "诗 107:19-20", "诗 147:3", "赛 53:4-5", "耶 17:14", "耶 30:17", "何 6:1", "雅 5:13-16"],
  },
  {
    title: "5. 感到孤单时，神说你被看见、被记念",
    refs: ["诗 8:4", "诗 33:18", "诗 34:15", "诗 139:1-3", "诗 139:7-10", "诗 139:17-18", "赛 49:15-16", "太 10:29-31", "路 12:6-7", "约 10:14"],
  },
  {
    title: "6. 低谷中，神给盼望与前路",
    refs: ["诗 27:13-14", "诗 37:23-24", "诗 40:1-3", "诗 71:14", "诗 130:5", "耶 29:11", "哀 3:22-23", "哀 3:25-26", "罗 8:28", "罗 15:13"],
  },
  {
    title: "7. 跌倒后，神仍扶持并再建立",
    refs: ["诗 37:23-24", "诗 51:10-12", "诗 86:11", "诗 138:7-8", "箴 24:16", "弥 7:8", "罗 8:1", "来 4:15-16", "约壹 1:9", "犹 1:24"],
  },
  {
    title: "8. 在患难中持守信心与忍耐",
    refs: ["诗 9:9-10", "诗 18:2", "诗 27:14", "诗 31:24", "诗 34:19", "诗 46:10", "罗 5:3-5", "雅 1:2-4", "彼前 1:6-7", "启 21:4"],
  },
  {
    title: "9. 当心里发沉、想躲起来",
    refs: ["诗 6:6", "诗 13:1-2", "诗 25:16-18", "诗 31:9", "诗 38:9", "诗 61:1-2", "诗 69:29", "诗 77:1-2"],
  },
  {
    title: "10. 神靠近伤痛，亲自扶起",
    refs: ["诗 9:12", "诗 10:17", "诗 34:6", "诗 56:8", "诗 71:20-21", "诗 119:76", "赛 66:13", "太 5:4"],
  },
  {
    title: "11. 夜里无力时，神仍看顾",
    refs: ["诗 3:5", "诗 4:6-7", "诗 16:7-8", "诗 17:8", "诗 63:6-8", "诗 77:11-12", "诗 119:55", "哀 3:55-57"],
  },
  {
    title: "12. 惧怕未来时，神给稳妥",
    refs: ["诗 27:1-3", "诗 56:3-4", "诗 112:7-8", "箴 3:5-6", "箴 18:10", "赛 26:4", "赛 35:3-4", "提后 1:7"],
  },
  {
    title: "13. 觉得自己不配时，神仍接纳",
    refs: ["诗 51:17", "诗 65:3", "诗 103:10-12", "赛 1:18", "路 15:20", "约 6:37", "罗 8:32", "来 7:25"],
  },
  {
    title: "14. 走不动时，神一步步引导",
    refs: ["诗 25:4-5", "诗 32:8", "诗 37:5-6", "诗 48:14", "诗 73:23-24", "诗 119:105", "箴 16:9", "约 10:27-28"],
  },
  {
    title: "15. 在关系压力中，神给温柔与界限",
    refs: ["诗 37:7-9", "诗 141:3", "箴 15:1", "箴 15:18", "太 5:9", "罗 12:18", "弗 4:31-32", "西 3:12-15"],
  },
  {
    title: "16. 身体与心灵一起疲惫时",
    refs: ["诗 41:3", "诗 103:13-14", "诗 127:2", "赛 30:15", "耶 31:25", "可 6:31", "林后 4:7-10", "帖前 5:23-24"],
  },
  {
    title: "17. 长期煎熬中，学会等候",
    refs: ["诗 27:14", "诗 37:34", "诗 40:17", "诗 123:1-2", "诗 130:1-2", "哈 3:17-19", "罗 12:12", "来 10:35-36"],
  },
  {
    title: "18. 最后，神要擦干眼泪",
    refs: ["赛 25:8", "赛 61:1-3", "约 11:25-26", "林前 15:54-58", "帖前 4:16-18", "彼前 1:3-5", "启 7:16-17", "启 21:3-5"],
  },
];

const REST_RESTORE_TITLES_EN: string[] = [
  "Return to God when weary",
  "God renews the weak",
  "Peace and comfort in anxiety",
  "Healing for the wounded",
  "Seen and remembered by God",
  "Hope and direction in low valleys",
  "Raised again after falling",
  "Enduring through troubles",
  "When the heart sinks",
  "God draws near to pain",
  "Guarded through the night",
  "Security for the future",
  "Accepted even when unworthy",
  "Step-by-step guidance",
  "Grace under relational pressure",
  "Body and soul in exhaustion",
  "Learning to wait long-term",
  "Final consolation and restoration",
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
  const bookId = REST_RESTORE_BOOK_ABBR_TO_ID[abbr];
  if (!bookId || !Number.isInteger(chapter) || chapter < 1) return null;
  const verseList = parseVerseList(verseLabel);
  if (!verseList.length) return null;
  return { bookId, chapter, verseList, verseLabel };
}

function translationIdForLocale(locale: "zh-CN" | "en"): string {
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

export function ExploreRestRestoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const [verseTextByRef, setVerseTextByRef] = useState<Record<string, string>>({});
  const [expandedCategoryIndex, setExpandedCategoryIndex] = useState<number | null>(null);
  const categoryTitles = locale === "en" ? REST_RESTORE_TITLES_EN : null;

  const parsedRefByRaw = useMemo(() => {
    const entries = REST_RESTORE_CATEGORIES.flatMap((category) => category.refs).map((raw) => [
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
          <Text style={shared.backLinkText}>{t("pages.explore.restRestoreBack")}</Text>
        </Pressable>

        <Text style={styles.pageTitle}>{t("pages.explore.restRestoreTitle")}</Text>
        <Text style={styles.eyebrow}>{t("pages.explore.restRestoreSubtitle")}</Text>

        <View style={styles.accordionList}>
          {REST_RESTORE_CATEGORIES.map((category, index) => (
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
