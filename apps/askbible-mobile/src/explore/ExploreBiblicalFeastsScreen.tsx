import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { exploreStyles as shared, useExploreScrollContentStyle } from "./exploreParchmentStyles";
import { pushExploreReadChapter, useExploreReadReturnPath } from "./explore-read-chapter-nav";
import { useState } from "react";

type ReadTarget = {
  label: string;
  bookId: string;
  chapter: number;
  verse: number;
};

const ZH_BOOK_LABELS: Record<string, string> = {
  MAT: "太",
  MRK: "可",
  LUK: "路",
  JHN: "约",
  ACT: "徒",
  ROM: "罗",
  "1CO": "林前",
  "1TH": "帖前",
  HEB: "来",
  JAS: "雅",
  REV: "启",
  EXO: "出",
  LEV: "利",
  NUM: "民",
  PSA: "诗",
  ISA: "赛",
  JOL: "珥",
  ZEC: "亚",
};

function formatReadTargetLabel(target: ReadTarget, locale: string): string {
  if (!/^zh\b/i.test(locale)) return target.label;
  const book = ZH_BOOK_LABELS[target.bookId] ?? target.bookId;
  return `${book} ${target.chapter}:${target.verse}`;
}

type FeastTimelineItem = {
  id: string;
  season: "spring" | "autumn" | "church";
  orderLabel: string;
  readTargets: ReadTarget[];
};

const BIBLICAL_FEAST_TIMELINE: FeastTimelineItem[] = [
  {
    id: "passover",
    season: "spring",
    orderLabel: "01",
    readTargets: [
      { label: "LEV 23:5", bookId: "LEV", chapter: 23, verse: 5 },
      { label: "EXO 12:13", bookId: "EXO", chapter: 12, verse: 13 },
      { label: "JHN 1:29", bookId: "JHN", chapter: 1, verse: 29 },
    ],
  },
  {
    id: "unleavened-bread",
    season: "spring",
    orderLabel: "02",
    readTargets: [
      { label: "LEV 23:6", bookId: "LEV", chapter: 23, verse: 6 },
      { label: "EXO 12:15", bookId: "EXO", chapter: 12, verse: 15 },
      { label: "1CO 5:7", bookId: "1CO", chapter: 5, verse: 7 },
    ],
  },
  {
    id: "firstfruits",
    season: "spring",
    orderLabel: "03",
    readTargets: [
      { label: "LEV 23:10", bookId: "LEV", chapter: 23, verse: 10 },
      { label: "1CO 15:20", bookId: "1CO", chapter: 15, verse: 20 },
      { label: "ROM 11:16", bookId: "ROM", chapter: 11, verse: 16 },
    ],
  },
  {
    id: "weeks-pentecost",
    season: "spring",
    orderLabel: "04",
    readTargets: [
      { label: "LEV 23:15", bookId: "LEV", chapter: 23, verse: 15 },
      { label: "ACT 2:1", bookId: "ACT", chapter: 2, verse: 1 },
      { label: "JAS 1:18", bookId: "JAS", chapter: 1, verse: 18 },
    ],
  },
  {
    id: "trumpets",
    season: "autumn",
    orderLabel: "05",
    readTargets: [
      { label: "LEV 23:24", bookId: "LEV", chapter: 23, verse: 24 },
      { label: "NUM 10:10", bookId: "NUM", chapter: 10, verse: 10 },
      { label: "1TH 4:16", bookId: "1TH", chapter: 4, verse: 16 },
    ],
  },
  {
    id: "atonement",
    season: "autumn",
    orderLabel: "06",
    readTargets: [
      { label: "LEV 23:27", bookId: "LEV", chapter: 23, verse: 27 },
      { label: "LEV 16:30", bookId: "LEV", chapter: 16, verse: 30 },
      { label: "HEB 9:12", bookId: "HEB", chapter: 9, verse: 12 },
    ],
  },
  {
    id: "tabernacles",
    season: "autumn",
    orderLabel: "07",
    readTargets: [
      { label: "LEV 23:34", bookId: "LEV", chapter: 23, verse: 34 },
      { label: "JHN 1:14", bookId: "JHN", chapter: 1, verse: 14 },
      { label: "REV 21:3", bookId: "REV", chapter: 21, verse: 3 },
    ],
  },
];

const CHURCH_FEAST_TIMELINE: FeastTimelineItem[] = [
  {
    id: "advent",
    season: "church",
    orderLabel: "01",
    readTargets: [
      { label: "MAT 24:42", bookId: "MAT", chapter: 24, verse: 42 },
      { label: "ISA 9:2", bookId: "ISA", chapter: 9, verse: 2 },
      { label: "REV 22:20", bookId: "REV", chapter: 22, verse: 20 },
    ],
  },
  {
    id: "christmas",
    season: "church",
    orderLabel: "02",
    readTargets: [
      { label: "LUK 2:11", bookId: "LUK", chapter: 2, verse: 11 },
      { label: "ISA 9:6", bookId: "ISA", chapter: 9, verse: 6 },
      { label: "JHN 1:14", bookId: "JHN", chapter: 1, verse: 14 },
    ],
  },
  {
    id: "epiphany",
    season: "church",
    orderLabel: "03",
    readTargets: [
      { label: "MAT 2:1", bookId: "MAT", chapter: 2, verse: 1 },
      { label: "ISA 60:3", bookId: "ISA", chapter: 60, verse: 3 },
      { label: "JHN 8:12", bookId: "JHN", chapter: 8, verse: 12 },
    ],
  },
  {
    id: "ash-wednesday",
    season: "church",
    orderLabel: "04",
    readTargets: [
      { label: "JOE 2:12", bookId: "JOL", chapter: 2, verse: 12 },
      { label: "MAT 6:16", bookId: "MAT", chapter: 6, verse: 16 },
      { label: "PSA 51:10", bookId: "PSA", chapter: 51, verse: 10 },
    ],
  },
  {
    id: "lent",
    season: "church",
    orderLabel: "05",
    readTargets: [
      { label: "MAT 4:2", bookId: "MAT", chapter: 4, verse: 2 },
      { label: "LUK 9:23", bookId: "LUK", chapter: 9, verse: 23 },
      { label: "ISA 58:6", bookId: "ISA", chapter: 58, verse: 6 },
    ],
  },
  {
    id: "palm-sunday",
    season: "church",
    orderLabel: "06",
    readTargets: [
      { label: "MAT 21:9", bookId: "MAT", chapter: 21, verse: 9 },
      { label: "ZEC 9:9", bookId: "ZEC", chapter: 9, verse: 9 },
      { label: "JHN 12:13", bookId: "JHN", chapter: 12, verse: 13 },
    ],
  },
  {
    id: "good-friday",
    season: "church",
    orderLabel: "07",
    readTargets: [
      { label: "ISA 53:5", bookId: "ISA", chapter: 53, verse: 5 },
      { label: "JHN 19:30", bookId: "JHN", chapter: 19, verse: 30 },
      { label: "LUK 23:46", bookId: "LUK", chapter: 23, verse: 46 },
    ],
  },
  {
    id: "easter",
    season: "church",
    orderLabel: "08",
    readTargets: [
      { label: "MAT 28:6", bookId: "MAT", chapter: 28, verse: 6 },
      { label: "1CO 15:4", bookId: "1CO", chapter: 15, verse: 4 },
      { label: "JHN 11:25", bookId: "JHN", chapter: 11, verse: 25 },
    ],
  },
  {
    id: "ascension",
    season: "church",
    orderLabel: "09",
    readTargets: [
      { label: "ACT 1:9", bookId: "ACT", chapter: 1, verse: 9 },
      { label: "LUK 24:51", bookId: "LUK", chapter: 24, verse: 51 },
      { label: "HEB 4:14", bookId: "HEB", chapter: 4, verse: 14 },
    ],
  },
  {
    id: "pentecost-church",
    season: "church",
    orderLabel: "10",
    readTargets: [
      { label: "ACT 2:4", bookId: "ACT", chapter: 2, verse: 4 },
      { label: "JHN 14:26", bookId: "JHN", chapter: 14, verse: 26 },
      { label: "ROM 8:11", bookId: "ROM", chapter: 8, verse: 11 },
    ],
  },
];

const BOTTOM_PAD = 140;

export function ExploreBiblicalFeastsScreen() {
  const router = useRouter();
  const exploreReturn = useExploreReadReturnPath();
  const insets = useSafeAreaInsets();
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: 8 + insets.top,
    paddingBottom: BOTTOM_PAD + insets.bottom,
  });
  const { locale } = useLocale();
  const [expandedFeastId, setExpandedFeastId] = useState<string>("advent");
  const springLabel = locale === "en" ? "Spring Feasts" : t("pages.explore.biblicalFeastsSeasonSpring");
  const autumnLabel = locale === "en" ? "Autumn Feasts" : t("pages.explore.biblicalFeastsSeasonAutumn");

  const mapRows = (rows: FeastTimelineItem[], copyKey: "feasts" | "churchFeasts") =>
    rows.map((row) => ({
      ...row,
      seasonLabel: row.season === "spring" ? springLabel : autumnLabel,
      month: t(`pages.explore.biblicalFeasts.${copyKey}.${row.id}.month`),
      title: t(`pages.explore.biblicalFeasts.${copyKey}.${row.id}.title`),
      date: t(`pages.explore.biblicalFeasts.${copyKey}.${row.id}.date`),
      scripture: t(`pages.explore.biblicalFeasts.${copyKey}.${row.id}.scripture`),
      summary: t(`pages.explore.biblicalFeasts.${copyKey}.${row.id}.summary`),
      practice: t(`pages.explore.biblicalFeasts.${copyKey}.${row.id}.practice`),
      fulfillment: t(`pages.explore.biblicalFeasts.${copyKey}.${row.id}.fulfillment`),
    }));

  const feastRows = mapRows(BIBLICAL_FEAST_TIMELINE, "feasts");
  const churchFeastRows = mapRows(CHURCH_FEAST_TIMELINE, "churchFeasts");

  const openRead = (target: ReadTarget) => {
    pushExploreReadChapter(
      router,
      {
        bookId: target.bookId,
        chapter: target.chapter,
        verse: target.verse,
      },
      exploreReturn,
    );
  };

  return (
    <View style={shared.root}>
      <ParchmentBottomFadeScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollContentStyle}
      >
        <Pressable onPress={() => router.back()} style={shared.yearDayCountBackLink} accessibilityRole="button">
          <Text style={shared.backLinkText}>{t("pages.explore.biblicalFeastsBack")}</Text>
        </Pressable>

        <Text style={styles.pageTitle}>{t("pages.explore.biblicalFeastsTitle")}</Text>
        <Text style={styles.subtitle}>{t("pages.explore.biblicalFeastsSubtitle")}</Text>
        <Text style={styles.lead}>{t("pages.explore.biblicalFeastsLead")}</Text>

        <View style={styles.timelineHeader}>
          <Text style={styles.timelineHeading}>{t("pages.explore.biblicalFeastsChurchYearTitle")}</Text>
          <Text style={styles.timelineSubLead}>{t("pages.explore.biblicalFeastsChurchYearLead")}</Text>
        </View>

        <View style={styles.timelineList}>
          {churchFeastRows.map((feast, index) => {
            const expanded = expandedFeastId === feast.id;
            return (
              <View key={feast.id}>
                <View style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <Text style={styles.timelineMonth}>{feast.month}</Text>
                    <Text style={styles.timelineDay}>{feast.date}</Text>
                  </View>
                  <View style={styles.timelineRailWrap}>
                    {index < churchFeastRows.length - 1 ? <View style={styles.timelineRail} /> : null}
                    <View style={styles.timelineDotWrap}>
                      <View style={styles.timelineDot} />
                    </View>
                    <Text style={styles.timelineOrder}>{feast.orderLabel}</Text>
                  </View>
                  <View style={styles.feastCard}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        setExpandedFeastId((current) => (current === feast.id ? "advent" : feast.id))
                      }
                      style={({ pressed }) => [styles.feastHeaderPressable, pressed && styles.feastHeaderPressed]}
                    >
                      <View style={styles.feastHeader}>
                        <Text style={styles.feastTitle}>{feast.title}</Text>
                        <Text style={styles.feastExpandMark}>{expanded ? "−" : "+"}</Text>
                      </View>
                      <Text style={styles.feastScripture}>{feast.scripture}</Text>
                    </Pressable>
                    {expanded ? (
                      <View style={styles.feastDetails}>
                        <Text style={styles.feastSummary}>{feast.summary}</Text>
                        <Text style={styles.sectionLabel}>{t("pages.explore.biblicalFeastsFulfillmentLabel")}</Text>
                        <Text style={styles.feastSecondary}>{feast.fulfillment}</Text>
                        <Text style={styles.sectionLabel}>{t("pages.explore.biblicalFeastsActionLabel")}</Text>
                        <Text style={styles.feastPractice}>{feast.practice}</Text>
                        <Text style={styles.sectionLabel}>{t("pages.explore.biblicalFeastsKeyScripturesLabel")}</Text>
                        <View style={styles.readTargetsWrap}>
                          {feast.readTargets.map((target) => (
                            <Pressable
                              key={`${feast.id}-${target.label}`}
                              onPress={() => openRead(target)}
                              accessibilityRole="button"
                              style={({ pressed }) => [styles.readTargetButton, pressed && styles.readTargetButtonPressed]}
                            >
                              <Text style={styles.readTargetButtonText}>{formatReadTargetLabel(target, locale)}</Text>
                            </Pressable>
                          ))}
                        </View>
                        <Pressable
                          onPress={() => openRead(feast.readTargets[0])}
                          accessibilityRole="button"
                          style={({ pressed }) => [styles.readNowButton, pressed && styles.readNowButtonPressed]}
                        >
                          <Text style={styles.readNowButtonText}>{t("pages.explore.biblicalFeastsReadNowCta")}</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.timelineHeaderSecondary}>
          <Text style={styles.timelineHeading}>{t("pages.explore.biblicalFeastsYearLineTitle")}</Text>
        </View>

        <View style={styles.timelineList}>
          {feastRows.map((feast, index) => {
            const showSeasonLabel = index === 0 || feastRows[index - 1]?.season !== feast.season;
            const expanded = expandedFeastId === feast.id;
            return (
              <View key={feast.id}>
                {showSeasonLabel ? (
                  <Text style={styles.seasonLabel}>{feast.seasonLabel}</Text>
                ) : null}
                <View style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <Text style={styles.timelineMonth}>{feast.month}</Text>
                    <Text style={styles.timelineDay}>{feast.date}</Text>
                  </View>
                  <View style={styles.timelineRailWrap}>
                    {index < feastRows.length - 1 ? <View style={styles.timelineRail} /> : null}
                    <View style={styles.timelineDotWrap}>
                      <View style={styles.timelineDot} />
                    </View>
                    <Text style={styles.timelineOrder}>{feast.orderLabel}</Text>
                  </View>
                  <View style={styles.feastCard}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        setExpandedFeastId((current) => (current === feast.id ? "passover" : feast.id))
                      }
                      style={({ pressed }) => [styles.feastHeaderPressable, pressed && styles.feastHeaderPressed]}
                    >
                      <View style={styles.feastHeader}>
                        <Text style={styles.feastTitle}>{feast.title}</Text>
                        <Text style={styles.feastExpandMark}>{expanded ? "−" : "+"}</Text>
                      </View>
                      <Text style={styles.feastScripture}>{feast.scripture}</Text>
                    </Pressable>
                    {expanded ? (
                      <View style={styles.feastDetails}>
                        <Text style={styles.feastSummary}>{feast.summary}</Text>
                        <Text style={styles.sectionLabel}>{t("pages.explore.biblicalFeastsFulfillmentLabel")}</Text>
                        <Text style={styles.feastSecondary}>{feast.fulfillment}</Text>
                        <Text style={styles.sectionLabel}>{t("pages.explore.biblicalFeastsActionLabel")}</Text>
                        <Text style={styles.feastPractice}>{feast.practice}</Text>
                        <Text style={styles.sectionLabel}>{t("pages.explore.biblicalFeastsKeyScripturesLabel")}</Text>
                        <View style={styles.readTargetsWrap}>
                          {feast.readTargets.map((target) => (
                            <Pressable
                              key={`${feast.id}-${target.label}`}
                              onPress={() => openRead(target)}
                              accessibilityRole="button"
                              style={({ pressed }) => [styles.readTargetButton, pressed && styles.readTargetButtonPressed]}
                            >
                              <Text style={styles.readTargetButtonText}>{formatReadTargetLabel(target, locale)}</Text>
                            </Pressable>
                          ))}
                        </View>
                        <Pressable
                          onPress={() => openRead(feast.readTargets[0])}
                          accessibilityRole="button"
                          style={({ pressed }) => [styles.readNowButton, pressed && styles.readNowButtonPressed]}
                        >
                          <Text style={styles.readNowButtonText}>{t("pages.explore.biblicalFeastsReadNowCta")}</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                </View>
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
    letterSpacing: 0.1,
    ...parchmentSans(500),
    color: c.inkSoft,
    textAlign: "center",
  },
  lead: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 22,
    ...parchmentSans(500),
    color: c.muted,
    textAlign: "center",
  },
  timelineHeader: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    gap: 10,
  },
  timelineHeading: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.35,
    ...parchmentSans(600),
    color: c.faint,
  },
  timelineHeaderSecondary: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    gap: 8,
  },
  timelineSubLead: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    ...parchmentSans(500),
    color: c.muted,
  },
  timelineList: {
    marginTop: 12,
    gap: 2,
  },
  seasonLabel: {
    marginTop: 12,
    marginBottom: 6,
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.3,
    ...parchmentSans(600),
    color: c.faint,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  timelineLeft: {
    width: 68,
    paddingTop: 10,
    alignItems: "flex-end",
    gap: 1,
  },
  timelineMonth: {
    fontSize: 11,
    lineHeight: 14,
    ...parchmentSans(600),
    color: c.faint,
  },
  timelineDay: {
    fontSize: 13,
    lineHeight: 17,
    ...parchmentSans(700),
    color: c.parchmentAccent,
  },
  timelineRailWrap: {
    width: 24,
    alignItems: "center",
    position: "relative",
  },
  timelineRail: {
    position: "absolute",
    top: 18,
    bottom: -16,
    width: 2,
    borderRadius: 1,
    backgroundColor: c.border,
  },
  timelineDotWrap: {
    marginTop: 12,
    width: 16,
    height: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surfaceSolid,
  },
  timelineDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: c.parchmentAccent,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
  timelineOrder: {
    marginTop: 4,
    fontSize: 9,
    lineHeight: 12,
    ...parchmentSans(700),
    color: c.faint,
  },
  feastCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: c.chapterCellBorder,
    backgroundColor: c.chapterCell,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 0,
  },
  feastHeaderPressable: {
    gap: 5,
  },
  feastHeaderPressed: {
    opacity: 0.82,
  },
  feastHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  feastTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    lineHeight: 24,
    ...parchmentSans(700),
    color: c.ink,
  },
  feastExpandMark: {
    marginTop: 1,
    width: 18,
    textAlign: "center",
    fontSize: 20,
    lineHeight: 20,
    ...parchmentSans(700),
    color: c.parchmentAccent,
  },
  feastScripture: {
    fontSize: 12,
    lineHeight: 17,
    ...parchmentSans(600),
    color: c.faint,
  },
  feastDetails: {
    marginTop: 8,
    gap: 6,
  },
  sectionLabel: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.25,
    ...parchmentSans(600),
    color: c.parchmentAccent,
  },
  feastSummary: {
    fontSize: 14,
    lineHeight: 21,
    ...parchmentSans(500),
    color: c.inkSoft,
  },
  feastSecondary: {
    fontSize: 13,
    lineHeight: 20,
    ...parchmentSans(500),
    color: c.inkSoft,
  },
  feastPractice: {
    fontSize: 13,
    lineHeight: 20,
    ...parchmentSans(500),
    color: c.muted,
  },
  readTargetsWrap: {
    marginTop: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  readTargetButton: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  readTargetButtonPressed: {
    opacity: 0.82,
  },
  readTargetButtonText: {
    fontSize: 12,
    lineHeight: 16,
    ...parchmentSans(600),
    color: c.inkSoft,
  },
  readNowButton: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: c.parchmentAccent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: c.chapterCellPressed,
  },
  readNowButtonPressed: {
    opacity: 0.82,
  },
  readNowButtonText: {
    fontSize: 12,
    lineHeight: 16,
    ...parchmentSans(700),
    color: c.parchmentAccent,
  },
});
