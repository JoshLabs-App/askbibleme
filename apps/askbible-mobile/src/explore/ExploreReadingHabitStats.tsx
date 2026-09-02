import { useEffect, useState, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { ExploreText as Text } from "./ExploreText";
import { useMemberAuth } from "../auth/MemberAuthProvider";
import { parchmentSans } from "../fonts/parchmentType";
import { useLocale } from "../i18n/LocaleProvider";
import { resolveUiText, tFormat } from "../i18n/site-copy";
import { ReadTodayReadingStats } from "../read/ReadTodayReadingStats";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { ReadYearDayTimeline } from "../read/ReadYearDayTimeline";
import {
  formatScriptureListenDuration,
  getScriptureListenTotalSec,
  subscribeScriptureListenTotals,
} from "../read/scripture-listen-totals";
import { useReadingHabitStats } from "../read/useReadingHabitStats";
import {
  formatAppUsageDuration,
  getAppUsageTotalSec,
  subscribeAppUsageTime,
} from "../shell/app-usage-time";
import { ExploreRecentBookmarks } from "./ExploreRecentBookmarks";
import { ExploreRecentChapters } from "./ExploreRecentChapters";
import { formatMemberJourneyDuration } from "@/lib/explore/member-journey-duration";

/** 探索首页上部：习惯统计 + 最近阅读/收藏。 */
export function ExploreReadingHabitStats() {
  const { locale } = useLocale();
  const { user } = useMemberAuth();
  const { yearDay, snapshot, completedDates } = useReadingHabitStats();
  const storedSec = useSyncExternalStore(subscribeAppUsageTime, getAppUsageTotalSec, () => 0);
  const [usageSec, setUsageSec] = useState(storedSec);
  const listenTotalSec = useSyncExternalStore(
    subscribeScriptureListenTotals,
    getScriptureListenTotalSec,
    () => 0,
  );

  useEffect(() => {
    setUsageSec(getAppUsageTotalSec());
    const id = setInterval(() => setUsageSec(getAppUsageTotalSec()), 10_000);
    return () => clearInterval(id);
  }, [storedSec]);

  const usageLabel = resolveUiText(locale, "使用时长", "Time in app");
  const usageValue = formatAppUsageDuration(usageSec, locale);
  const listenDurationLabel = formatScriptureListenDuration(listenTotalSec, locale);
  const listenLine = tFormat("pages.read.planPlayListenTotalLabel", {
    duration: listenDurationLabel,
  });
  const journeyValue =
    user?.createdAt != null && user.createdAt.trim()
      ? formatMemberJourneyDuration(user.createdAt, locale)
      : null;
  const journeyLabel = resolveUiText(locale, "一起走过", "Walking together");

  return (
    <View style={styles.wrap}>
      <View style={styles.inner}>
        <ReadYearDayTimeline completedDates={completedDates} />
        <ReadTodayReadingStats yearDay={yearDay} snapshot={snapshot} />
        <Text
          style={styles.metaLine}
          accessibilityRole="text"
          accessibilityLabel={`${usageLabel} ${usageValue}`}
        >
          {usageLabel}
          <Text style={styles.metaValue}>  {usageValue}</Text>
        </Text>
        <Text style={styles.metaLine} accessibilityRole="text">
          {listenLine}
        </Text>
        {journeyValue ? (
          <Text
            style={[styles.metaLine, styles.journeyLine]}
            accessibilityRole="text"
            accessibilityLabel={`${journeyLabel} ${journeyValue}`}
          >
            {journeyLabel}
            <Text style={styles.metaValue}>  {journeyValue}</Text>
          </Text>
        ) : null}
        <ExploreRecentChapters />
        <ExploreRecentBookmarks />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 8,
  },
  inner: {
    width: "100%",
    maxWidth: 340,
    alignItems: "stretch",
  },
  metaLine: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    ...parchmentSans(500),
    color: c.faint,
    textAlign: "center",
  },
  journeyLine: {
    marginBottom: 4,
  },
  metaValue: {
    ...parchmentSans(600),
    color: c.muted,
    fontVariant: ["tabular-nums"],
  },
});