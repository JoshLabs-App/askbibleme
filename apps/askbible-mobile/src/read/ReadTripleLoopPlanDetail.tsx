import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { t, tFormat } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { formatReadingPlanRange } from "./reading-plan/format-reading-range";
import { getReadingPlanDaySinceEpoch } from "./reading-plan/reading-plan-epoch";
import {
  TRIPLE_LOOP_EXPLORE_ARTICLE_SLUG,
} from "./reading-plan/triple-loop-plan";
import {
  NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG,
  NT_DEEP_REPEAT_PLAN_ID,
} from "./reading-plan/nt-deep-repeat-plan";
import {
  formatTripleLoopReadingLineVerbose,
  tripleLoopTrackTitle,
  type TripleLoopTrack,
} from "./reading-plan/triple-loop-reading";
import {
  hasUserTripleLoopProgress,
} from "./reading-plan/triple-loop-progress";
import { resetTripleLoopPlanToEasterDefault } from "./reading-plan/triple-loop-plan-sync";
import { useTripleLoopProgress } from "./reading-plan/useReadingPlanStores";
import { exploreArticleRoute } from "../explore/exploreFeaturedArticles";

const TRACKS: TripleLoopTrack[] = ["ot", "nt", "wisdom"];

export function ReadTripleLoopPlanDetail() {
  const router = useRouter();
  const { progress, refresh } = useTripleLoopProgress();
  const planDay = getReadingPlanDaySinceEpoch();
  const [resetting, setResetting] = useState(false);
  const [userAdjusted, setUserAdjusted] = useState(false);

  useEffect(() => {
    void hasUserTripleLoopProgress().then(setUserAdjusted);
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
      await resetTripleLoopPlanToEasterDefault();
      refresh();
      setUserAdjusted(false);
    } finally {
      setResetting(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.epochNote}>
        {t("pages.read.tripleLoopEpochNote")}{" "}
        {tFormat("pages.read.todayPlanDayMeta", { n: planDay })}
      </Text>
      <Pressable
        onPress={() => router.push(exploreArticleRoute(TRIPLE_LOOP_EXPLORE_ARTICLE_SLUG))}
        hitSlop={8}
        style={styles.whyArticleLinkWrap}
      >
        <Text style={styles.whyArticleLink}>{t("pages.read.tripleLoopWhyArticleLink")} →</Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("pages.read.tripleLoopTodayTitle")}</Text>
        <Text style={styles.sectionLead}>{t("pages.read.tripleLoopTodaySummary")}</Text>
        <View style={styles.todayList}>
          {TRACKS.map((track) => {
            const ptr = progress[track];
            return (
              <View key={track} style={styles.todayRow}>
                <Text style={styles.trackLabel}>{tripleLoopTrackTitle(track)}</Text>
                <Pressable onPress={() => openChapter(ptr.bookId, ptr.chapter)} hitSlop={8}>
                  <Text style={styles.todayLink}>
                    {formatReadingPlanRange({
                      bookId: ptr.bookId,
                      startChapter: ptr.chapter,
                      endChapter: ptr.chapter,
                      label: "",
                      planChapterTotal: 1,
                    })}
                  </Text>
                </Pressable>
                <Text style={styles.todayMeta}>
                  {formatTripleLoopReadingLineVerbose(ptr.bookId, ptr.chapter)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.deepReadBox}>
        <Text style={styles.deepReadTitle}>{t("pages.read.tripleLoopDeepReadTitle")}</Text>
        <Text style={styles.deepReadLead}>{t("pages.read.tripleLoopDeepReadLead")}</Text>
        <View style={styles.deepReadLinks}>
          <Pressable onPress={() => router.push({ pathname: "/read/plans/[planId]", params: { planId: NT_DEEP_REPEAT_PLAN_ID } })} hitSlop={8}>
            <Text style={styles.deepReadLinkPrimary}>{t("pages.read.tripleLoopDeepReadPlanLink")} →</Text>
          </Pressable>
          <Text style={styles.deepReadSep}>·</Text>
          <Pressable onPress={() => router.push(exploreArticleRoute(NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG))} hitSlop={8}>
            <Text style={styles.deepReadLinkSecondary}>{t("pages.read.tripleLoopDeepReadArticleLink")} →</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.principlesBox}>
        <Text style={styles.principlesTitle}>{t("pages.read.tripleLoopPrinciplesTitle")}</Text>
        <Text style={styles.principleItem}>· {t("pages.read.tripleLoopPrinciple1")}</Text>
        <Text style={styles.principleItem}>· {t("pages.read.tripleLoopPrinciple2")}</Text>
        <Text style={styles.principleItem}>· {t("pages.read.tripleLoopPrinciple3")}</Text>
        <Pressable
          onPress={() => router.push(exploreArticleRoute(TRIPLE_LOOP_EXPLORE_ARTICLE_SLUG))}
          hitSlop={8}
        >
          <Text style={styles.whyArticleLink}>{t("pages.read.tripleLoopWhyArticleLink")} →</Text>
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
  principlesBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255, 252, 245, 0.45)",
    gap: 8,
  },
  deepReadBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255, 252, 245, 0.45)",
    gap: 8,
  },
  deepReadTitle: {
    fontSize: 11,
    ...parchmentSans(600),
    letterSpacing: 1.1,
    color: c.faint,
  },
  deepReadLead: {
    fontSize: 12,
    lineHeight: 18,
    color: c.muted,
  },
  deepReadLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  deepReadLinkPrimary: {
    fontSize: 12,
    ...parchmentSans(600),
    color: c.ink,
    textDecorationLine: "underline",
    textDecorationColor: c.border,
  },
  deepReadLinkSecondary: {
    fontSize: 12,
    ...parchmentSans(500),
    color: c.muted,
    textDecorationLine: "underline",
    textDecorationColor: c.border,
  },
  deepReadSep: {
    fontSize: 12,
    color: c.faint,
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
