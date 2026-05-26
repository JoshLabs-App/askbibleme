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

type PrayerScenario = {
  title: string;
  titleEn: string;
  refs: string[];
};

type ParsedRef = {
  bookId: string;
  chapter: number;
  verseList: number[];
  verseLabel: string;
};

export const PRAYER_SCRIPTURE_BOOK_ABBR_TO_ID: Record<string, string> = {
  创世记: "GEN",
  创: "GEN",
  出埃及记: "EXO",
  出: "EXO",
  利未记: "LEV",
  民数记: "NUM",
  申命记: "DEU",
  申: "DEU",
  约书亚记: "JOS",
  书: "JOS",
  诗篇: "PSA",
  诗: "PSA",
  箴言: "PRO",
  箴: "PRO",
  传道书: "ECC",
  雅歌: "SNG",
  以赛亚书: "ISA",
  赛: "ISA",
  耶利米书: "JER",
  耶: "JER",
  玛拉基书: "MAL",
  玛: "MAL",
  马太福音: "MAT",
  太: "MAT",
  马可福音: "MRK",
  可: "MRK",
  路加福音: "LUK",
  路: "LUK",
  约翰福音: "JHN",
  约: "JHN",
  使徒行传: "ACT",
  徒: "ACT",
  罗马书: "ROM",
  罗: "ROM",
  哥林多前书: "1CO",
  林前: "1CO",
  哥林多后书: "2CO",
  林后: "2CO",
  加拉太书: "GAL",
  以弗所书: "EPH",
  弗: "EPH",
  腓立比书: "PHP",
  腓: "PHP",
  歌罗西书: "COL",
  西: "COL",
  帖撒罗尼迦后书: "2TH",
  帖后: "2TH",
  提摩太前书: "1TI",
  提前: "1TI",
  提摩太后书: "2TI",
  提后: "2TI",
  希伯来书: "HEB",
  来: "HEB",
  雅各书: "JAS",
  雅: "JAS",
  彼得前书: "1PE",
  彼前: "1PE",
  约翰一书: "1JN",
  约壹: "1JN",
  约翰三书: "3JN",
  约叁: "3JN",
};

export const PRAYER_SCRIPTURE_SCENARIOS: PrayerScenario[] = [
  {
    title: "1. 为自己",
    titleEn: "1. For Myself",
    refs: [
      "诗篇 139:23-24",
      "诗篇 51:10",
      "罗马书 12:1-2",
      "加拉太书 2:20",
      "腓立比书 4:6-7",
      "腓立比书 1:6",
      "哥林多后书 5:17",
      "以弗所书 3:16-19",
      "箴言 4:23",
      "雅各书 1:5",
      "约翰福音 15:5",
      "马太福音 6:33",
      "以赛亚书 40:31",
      "彼得前书 5:7",
      "提摩太后书 1:7",
    ],
  },
  {
    title: "2. 为孩子",
    titleEn: "2. For Children",
    refs: [
      "箴言 22:6",
      "以赛亚书 54:13",
      "路加福音 2:52",
      "诗篇 127:3-5",
      "申命记 6:6-7",
      "箴言 3:5-6",
      "箴言 4:23",
      "箴言 1:8-9",
      "约翰三书 1:4",
      "马太福音 19:14",
      "以弗所书 6:1-4",
      "歌罗西书 3:20-21",
      "提摩太后书 3:15",
      "民数记 6:24-26",
      "腓立比书 1:9-11",
    ],
  },
  {
    title: "3. 为婚姻",
    titleEn: "3. For Marriage",
    refs: [
      "创世记 2:24",
      "以弗所书 5:22-33",
      "哥林多前书 13:4-8",
      "传道书 4:9-12",
      "歌罗西书 3:13-14",
      "彼得前书 3:7",
      "箴言 18:22",
      "箴言 31:10-12",
      "马可福音 10:8-9",
      "希伯来书 13:4",
      "雅歌 8:6-7",
      "腓立比书 2:3-4",
      "罗马书 12:10",
      "约翰一书 4:7-8",
      "雅各书 1:19",
    ],
  },
  {
    title: "4. 为家庭",
    titleEn: "4. For Family",
    refs: [
      "约书亚记 24:15",
      "诗篇 127:1",
      "诗篇 128:1-4",
      "歌罗西书 3:12-15",
      "以弗所书 4:2-3",
      "以弗所书 4:32",
      "申命记 6:4-9",
      "箴言 24:3-4",
      "提摩太前书 5:8",
      "使徒行传 16:31",
      "诗篇 133:1",
      "罗马书 15:5-6",
      "彼得前书 4:8-10",
      "加拉太书 6:2",
      "民数记 6:24-26",
    ],
  },
  {
    title: "5. 为工作",
    titleEn: "5. For Work",
    refs: [
      "歌罗西书 3:23-24",
      "箴言 16:3",
      "箴言 16:9",
      "箴言 22:29",
      "箴言 10:4",
      "传道书 9:10",
      "诗篇 90:17",
      "雅各书 1:5",
      "腓立比书 4:13",
      "马太福音 5:16",
      "提摩太后书 2:15",
      "以弗所书 6:7-8",
      "哥林多前书 10:31",
      "帖撒罗尼迦后书 3:10-12",
      "申命记 8:18",
    ],
  },
  {
    title: "6. 为健康",
    titleEn: "6. For Health",
    refs: [
      "诗篇 103:2-5",
      "耶利米书 17:14",
      "雅各书 5:14-16",
      "以赛亚书 53:5",
      "约翰三书 1:2",
      "箴言 17:22",
      "箴言 4:20-22",
      "诗篇 41:3",
      "出埃及记 15:26",
      "马太福音 11:28-30",
      "哥林多前书 6:19-20",
      "以赛亚书 40:29-31",
      "诗篇 23:1-3",
      "马可福音 5:34",
      "耶利米书 30:17",
    ],
  },
  {
    title: "7. 为父母",
    titleEn: "7. For Parents",
    refs: [
      "出埃及记 20:12",
      "以弗所书 6:2-3",
      "箴言 23:22-25",
      "提摩太前书 5:4",
      "提摩太前书 5:8",
      "利未记 19:3",
      "申命记 5:16",
      "箴言 1:8-9",
      "箴言 20:20",
      "箴言 30:17",
      "马太福音 15:4",
      "约翰福音 19:26-27",
      "歌罗西书 3:20",
      "诗篇 71:9",
      "诗篇 92:14",
    ],
  },
  {
    title: "8. 为关系",
    titleEn: "8. For Relationships",
    refs: [
      "罗马书 12:18",
      "以弗所书 4:29",
      "马太福音 5:9",
      "马太福音 18:15",
      "箴言 15:1",
      "箴言 17:17",
      "箴言 27:17",
      "歌罗西书 3:12-14",
      "以弗所书 4:31-32",
      "雅各书 1:19",
      "罗马书 12:10",
      "哥林多前书 13:4-7",
      "希伯来书 12:14",
      "彼得前书 3:8-9",
      "约翰一书 4:7",
    ],
  },
  {
    title: "9. 为经济",
    titleEn: "9. For Finances",
    refs: [
      "腓立比书 4:19",
      "马太福音 6:31-33",
      "箴言 3:9-10",
      "申命记 8:18",
      "玛拉基书 3:10",
      "哥林多后书 9:6-8",
      "箴言 10:22",
      "箴言 11:24-25",
      "箴言 21:5",
      "箴言 22:7",
      "路加福音 6:38",
      "提摩太前书 6:6-10",
      "希伯来书 13:5",
      "诗篇 37:25",
      "马太福音 6:19-21",
    ],
  },
  {
    title: "10. 为前路",
    titleEn: "10. For the Road Ahead",
    refs: [
      "箴言 3:5-6",
      "诗篇 119:105",
      "耶利米书 29:11",
      "诗篇 32:8",
      "以赛亚书 30:21",
      "以赛亚书 43:18-19",
      "以赛亚书 58:11",
      "诗篇 37:5",
      "诗篇 25:4-5",
      "诗篇 23:3-4",
      "约翰福音 10:27",
      "雅各书 1:5",
      "罗马书 8:28",
      "腓立比书 1:6",
      "腓立比书 3:13-14",
    ],
  },
];

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
  const bookId = PRAYER_SCRIPTURE_BOOK_ABBR_TO_ID[abbr];
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

export function ExplorePrayerScriptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const [verseTextByRef, setVerseTextByRef] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true });

  const parsedRefByRaw = useMemo(() => {
    const entries = PRAYER_SCRIPTURE_SCENARIOS
      .flatMap((category) => category.refs)
      .map((raw) => [raw, parseRef(raw)] as const);
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
            const loaded = await loadChapterFromBundledTranslation(bookId, Number(chapterRaw), translationId);
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
          next[raw] = t("pages.explore.prayerScriptureUnavailable");
          continue;
        }
        const chapterKey = `${parsed.bookId}:${parsed.chapter}`;
        const loaded = chapterCache.get(chapterKey);
        const resolved = loaded ? verseTextForParsedRef(loaded.verses, parsed) : null;
        next[raw] = resolved ?? t("pages.explore.prayerScriptureUnavailable");
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
          <Text style={shared.backLinkText}>{t("pages.explore.prayerScriptureBack")}</Text>
        </Pressable>

        <Text style={styles.pageTitle}>{t("pages.explore.prayerScriptureTitle")}</Text>
        <Text style={styles.subtitle}>{t("pages.explore.prayerScriptureSubtitle")}</Text>
        <Text style={styles.tapHint}>{t("pages.explore.prayerScriptureTapHint")}</Text>

        <View style={styles.listWrap}>
          {PRAYER_SCRIPTURE_SCENARIOS.map((scenario, index) => {
            const isOpen = !!expanded[index];
            const title = locale === "en" ? scenario.titleEn : scenario.title;
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
                    {locale === "en" ? " verses" : " 节"}
                    {isOpen ? (locale === "en" ? " · Hide" : " · 收起") : locale === "en" ? " · Show" : " · 展开"}
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
    </View>
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
