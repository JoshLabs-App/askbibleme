import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ExploreTimelineFadeLine } from "../explore/ExploreTimelineFadeLine";
import { tFormat } from "../i18n/site-copy";
import { getYearDayTimeline } from "./year-day-timeline";
import { READ_NEW_TESTAMENT_ACCENT } from "./canon-section-theme";

/** 全年进度横轴（无月份/第 N 天文案，数字见下方统计） */
export function ReadYearDayTimeline() {
  const now = useMemo(() => new Date(), []);
  const { dayOfYear, daysInYear, progress } = useMemo(() => getYearDayTimeline(now), [now]);
  const markerLeftPct = `${progress * 100}%` as const;

  return (
    <View
      style={styles.wrap}
      accessibilityRole="text"
      accessibilityLabel={tFormat("pages.read.yearTimelineA11y", {
        day: dayOfYear,
        total: daysInYear,
      })}
    >
      <View style={styles.track}>
        <ExploreTimelineFadeLine />
        <View style={[styles.todayMarker, { left: markerLeftPct }]} pointerEvents="none">
          <View style={styles.todayDot} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    marginTop: 6,
    marginBottom: 2,
  },
  track: {
    position: "relative",
    height: 20,
    justifyContent: "center",
  },
  todayMarker: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  todayDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: READ_NEW_TESTAMENT_ACCENT,
    borderWidth: 1.5,
    borderColor: READ_NEW_TESTAMENT_ACCENT,
  },
});
