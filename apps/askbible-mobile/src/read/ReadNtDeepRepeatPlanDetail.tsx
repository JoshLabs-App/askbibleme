import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { t, tFormat } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { formatReadingPlanRange } from "./reading-plan/format-reading-range";
import {
  NT_DEEP_REPEAT_CURRICULUM,
  ntDeepRepeatSegmentKey,
  ntDeepRepeatSegmentPrimaryRange,
} from "@/lib/bible/reading-plans/nt-deep-repeat-curriculum";
import { ntDeepRepeatOneCycleDays } from "./reading-plan/nt-deep-repeat-pace";
import { resetNtDeepRepeatProgress, hasUserNtDeepRepeatProgress } from "./reading-plan/nt-deep-repeat-progress";
import {
  currentNtDeepRepeatSegment,
  formatNtDeepRepeatOtLine,
  formatNtDeepRepeatSegmentLabel,
  formatNtDeepRepeatSegmentStageRange,
  ntDeepRepeatTrackTitle,
  resolveNtDeepRepeatSegmentDayTarget,
} from "./reading-plan/nt-deep-repeat-reading";
import { useEffectiveReadingPlanPrefs, useNtDeepRepeatProgress } from "./reading-plan/useReadingPlanStores";
import { resolveEffectiveEpochDay } from "./reading-plan/reading-plan-ahead";
import {
  NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG,
} from "./reading-plan/nt-deep-repeat-plan";
import { TRIPLE_LOOP_PLAN_ID } from "./reading-plan/triple-loop-plan";
import { exploreArticleRoute } from "../explore/exploreFeaturedArticles";

export function ReadNtDeepRepeatPlanDetail() {
  const router = useRouter();
  const { progress, refresh } = useNtDeepRepeatProgress();
  const { prefs } = useEffectiveReadingPlanPrefs();
  const planDay = resolveEffectiveEpochDay(prefs);
  const [resetting, setResetting] = useState(false);
  const [userAdjusted, setUserAdjusted] = useState(false);

  const ntSegment = currentNtDeepRepeatSegment(progress);
  const stageCount = NT_DEEP_REPEAT_CURRICULUM.length;
  const segmentTotal = resolveNtDeepRepeatSegmentDayTarget(progress);
  const cycleDays = ntDeepRepeatOneCycleDays(
    progress.pace,
    progress.startedAt ? new Date(`${progress.startedAt}T12:00:00`) : new Date(),
  );

  useEffect(() => {
    void hasUserNtDeepRepeatProgress().then(setUserAdjusted);
  }, [progress]);

  const openChapter = (bookId: string, chapter: number) => {
    router.push({
      pathname: "/read/[bookId]/[chapter]",
      params: { bookId, chapter: String(chapter), planFlow: "1" },
    });
  };

  const reset = async () => {
    setResetting(true);
    try {
      await resetNtDeepRepeatProgress();
      refresh();
      setUserAdjusted(false);
    } finally {
      setResetting(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.epochNote}>
        {t("pages.read.ntDeepRepeatStartNote")}{" "}
        {tFormat("pages.read.todayPlanDayMeta", { n: planDay })}
      </Text>
      <Pressable
        onPress={() => router.push(exploreArticleRoute(NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG))}
        hitSlop={8}
        style={styles.whyArticleLinkWrap}
      >
        <Text style={styles.whyArticleLink}>{t("pages.read.ntDeepRepeatWhyArticleLink")} →</Text>
      </Pressable>

      <View style={styles.lighterPathBox}>
        <Text style={styles.lighterPathTitle}>{t("pages.read.ntDeepRepeatLighterPathTitle")}</Text>
        <Text style={styles.lighterPathLead}>{t("pages.read.ntDeepRepeatLighterPathLead")}</Text>
        <Pressable
          onPress={() => router.push({ pathname: "/read/plans/[planId]", params: { planId: TRIPLE_LOOP_PLAN_ID } })}
          hitSlop={8}
          style={styles.lighterPathLinkWrap}
        >
          <Text style={styles.lighterPathLink}>{t("pages.read.ntDeepRepeatLighterPathLink")} →</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("pages.read.ntDeepRepeatTodayTitle")}</Text>
        <Text style={styles.sectionLead}>{t("pages.read.ntDeepRepeatTodaySummary")}</Text>
        <View style={styles.todayList}>
          {ntSegment ? (
            <View style={styles.todayRow}>
              <Text style={styles.trackLabel}>{ntDeepRepeatTrackTitle("nt")}</Text>
              {ntSegment.ranges.map((range) => (
                <Pressable
                  key={`${range.bookId}:${range.startChapter}-${range.endChapter}`}
                  onPress={() => openChapter(range.bookId, range.startChapter)}
                  hitSlop={8}
                >
                  <Text style={styles.todayLink}>
                    {formatReadingPlanRange({
                      bookId: range.bookId,
                      startChapter: range.startChapter,
                      endChapter: range.endChapter,
                      label: "",
                      planChapterTotal: 1,
                    })}
                  </Text>
                </Pressable>
              ))}
              <Text style={styles.todayMeta}>
                {formatNtDeepRepeatSegmentLabel(ntSegment, progress.dayInSegment, segmentTotal)}
              </Text>
            </View>
          ) : null}
          <View style={styles.todayRow}>
            <Text style={styles.trackLabel}>{ntDeepRepeatTrackTitle("ot")}</Text>
            <Pressable
              onPress={() => openChapter(progress.ot.bookId, progress.ot.chapter)}
              hitSlop={8}
            >
              <Text style={styles.todayLink}>
                {formatReadingPlanRange({
                  bookId: progress.ot.bookId,
                  startChapter: progress.ot.chapter,
                  endChapter: progress.ot.chapter,
                  label: "",
                  planChapterTotal: 1,
                })}
              </Text>
            </Pressable>
            <Text style={styles.todayMeta}>
              {formatNtDeepRepeatOtLine(progress.ot.bookId, progress.ot.chapter)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("pages.read.ntDeepRepeatLadderTitle")}</Text>
        <Text style={styles.sectionLead}>
          {tFormat("pages.read.ntDeepRepeatLadderLead", {
            stages: String(stageCount),
            days: String(progress.pace),
            cycle: String(cycleDays),
          })}
        </Text>
        <View style={styles.ladder}>
          {NT_DEEP_REPEAT_CURRICULUM.map((segment, index) => {
            const isCurrent = index === progress.curriculumIndex;
            const isDone = index < progress.curriculumIndex;
            const primary = ntDeepRepeatSegmentPrimaryRange(segment);
            return (
              <View
                key={ntDeepRepeatSegmentKey(segment)}
                style={[styles.ladderRow, isCurrent && styles.ladderRowCurrent, isDone && styles.ladderRowDone]}
              >
                <Text style={[styles.ladderStage, isCurrent && styles.ladderStageCurrent]}>
                  {tFormat("pages.read.ntDeepRepeatStageLabel", { n: String(index + 1) })}
                </Text>
                <View style={styles.ladderBody}>
                  <Pressable
                    disabled={!isCurrent && !isDone}
                    onPress={() => isCurrent ? openChapter(primary.bookId, primary.startChapter) : undefined}
                    hitSlop={6}
                  >
                    <Text style={[styles.ladderBook, isCurrent && styles.ladderBookCurrent]}>
                      {formatNtDeepRepeatSegmentStageRange(segment)}
                    </Text>
                  </Pressable>
                  {isCurrent ? (
                    <Text style={styles.ladderStatus}>
                      {tFormat("pages.read.ntDeepRepeatStageCurrent", {
                        day: String(progress.dayInSegment),
                        total: String(segmentTotal),
                      })}
                    </Text>
                  ) : isDone ? (
                    <Text style={styles.ladderStatusDone}>{t("pages.read.ntDeepRepeatStageDone")}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.principlesBox}>
        <Text style={styles.principlesTitle}>{t("pages.read.ntDeepRepeatPrinciplesTitle")}</Text>
        <Text style={styles.principleItem}>· {t("pages.read.ntDeepRepeatPrinciple1")}</Text>
        <Text style={styles.principleItem}>· {t("pages.read.ntDeepRepeatPrinciple2")}</Text>
        <Text style={styles.principleItem}>· {t("pages.read.ntDeepRepeatPrinciple3")}</Text>
        <Pressable
          onPress={() => router.push(exploreArticleRoute(NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG))}
          hitSlop={8}
        >
          <Text style={styles.whyArticleLink}>{t("pages.read.ntDeepRepeatWhyArticleLink")} →</Text>
        </Pressable>
        {userAdjusted ? (
          <Pressable disabled={resetting} onPress={() => void reset()} hitSlop={8}>
            <Text style={styles.resetLink}>{t("pages.read.tripleLoopResetToDefault")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 20, gap: 24 },
  epochNote: {
    fontSize: 11,
    lineHeight: 17,
    color: c.faint,
    textAlign: "center",
  },
  whyArticleLinkWrap: {
    alignSelf: "center",
    marginTop: -12,
  },
  whyArticleLink: {
    fontSize: 12,
    ...parchmentSans(500),
    color: c.muted,
    textDecorationLine: "underline",
    textDecorationColor: c.border,
  },
  lighterPathBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255, 252, 245, 0.45)",
    gap: 8,
  },
  lighterPathTitle: {
    fontSize: 11,
    ...parchmentSans(600),
    letterSpacing: 1.1,
    color: c.faint,
  },
  lighterPathLead: {
    fontSize: 12,
    lineHeight: 18,
    color: c.muted,
  },
  lighterPathLinkWrap: {
    alignSelf: "center",
    marginTop: 4,
  },
  lighterPathLink: {
    fontSize: 12,
    ...parchmentSans(500),
    color: c.muted,
    textDecorationLine: "underline",
    textDecorationColor: c.border,
  },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 11,
    ...parchmentSans(600),
    letterSpacing: 1.2,
    color: c.faint,
    textTransform: "uppercase",
  },
  sectionLead: {
    fontSize: 12,
    lineHeight: 18,
    color: c.muted,
  },
  todayList: {
    marginTop: 4,
    gap: 12,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: c.border,
    paddingLeft: 12,
  },
  todayRow: { gap: 4 },
  trackLabel: {
    fontSize: 11,
    ...parchmentSans(500),
    color: c.faint,
  },
  todayLink: {
    fontSize: 14,
    ...parchmentSans(600),
    color: c.ink,
    textDecorationLine: "underline",
    textDecorationColor: c.border,
  },
  todayMeta: {
    fontSize: 11,
    lineHeight: 16,
    color: c.muted,
  },
  ladder: {
    marginTop: 4,
    gap: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  ladderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.35)",
  },
  ladderRowCurrent: {
    backgroundColor: "rgba(255, 252, 245, 0.85)",
  },
  ladderRowDone: {
    opacity: 0.72,
  },
  ladderStage: {
    width: 52,
    fontSize: 11,
    ...parchmentSans(600),
    color: c.faint,
    paddingTop: 2,
  },
  ladderStageCurrent: {
    color: c.ink,
  },
  ladderBody: { flex: 1, gap: 2 },
  ladderBook: {
    fontSize: 13,
    lineHeight: 18,
    color: c.muted,
  },
  ladderBookCurrent: {
    ...parchmentSans(600),
    color: c.ink,
  },
  ladderStatus: {
    fontSize: 11,
    color: c.muted,
  },
  ladderStatusDone: {
    fontSize: 11,
    color: c.faint,
  },
  principlesBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255, 252, 245, 0.45)",
    gap: 8,
  },
  principlesTitle: {
    fontSize: 11,
    ...parchmentSans(600),
    letterSpacing: 1.1,
    color: c.faint,
  },
  principleItem: {
    fontSize: 12,
    lineHeight: 18,
    color: c.muted,
  },
  resetLink: {
    marginTop: 4,
    fontSize: 12,
    ...parchmentSans(500),
    color: c.muted,
    textDecorationLine: "underline",
  },
});
