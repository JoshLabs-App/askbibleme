import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { tFormat } from "../i18n/site-copy";
import {
  buildYearReadRangesBeforeToday,
  getYearDayTimeline,
  yearDayRangeToTrackFraction,
} from "@/lib/read/year-day-timeline";
import { READ_NEW_TESTAMENT_ACCENT } from "./canon-section-theme";

const EMPTY_DATES: readonly string[] = [];
const TRACK_H = 5;
/** 淡褐底轨：只标「全年轴」，不抢已读色 */
const TRACK_MID = "rgba(120, 53, 15, 0.18)";
const TRACK_CLEAR = "rgba(120, 53, 15, 0)";
/** 已读：实色金黄，与淡底轨拉开反差 */
const READ_FILL = "#E8A017";

type Props = {
  /** 习惯统计中的已读日历日 YYYY-MM-DD */
  completedDates?: readonly string[];
};

/** 全年进度横轴：淡底轨 + 实色已读 + 今日橙点 */
export function ReadYearDayTimeline({ completedDates = EMPTY_DATES }: Props) {
  const now = useMemo(() => new Date(), []);
  const { dayOfYear, daysInYear, progress } = useMemo(() => getYearDayTimeline(now), [now]);
  const ranges = useMemo(
    () => buildYearReadRangesBeforeToday(completedDates, now),
    [completedDates, now],
  );
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
        <LinearGradient
          colors={[TRACK_CLEAR, TRACK_MID, TRACK_MID, TRACK_CLEAR]}
          locations={[0, 0.14, 0.86, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.baseLine}
        />
        {ranges.map((range) => {
          const { left, width } = yearDayRangeToTrackFraction(range, daysInYear);
          if (width <= 0) return null;
          // 单日过窄时几乎看不见：至少约占两日宽
          const minW = 2 / Math.max(daysInYear, 1);
          const drawW = Math.max(width, minW);
          const drawLeft = Math.min(left, Math.max(0, 1 - drawW));
          return (
            <View
              key={`${range.startDay}-${range.endDay}`}
              style={[
                styles.readRange,
                {
                  left: `${drawLeft * 100}%`,
                  width: `${drawW * 100}%`,
                },
              ]}
              pointerEvents="none"
            />
          );
        })}
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
    height: 22,
    justifyContent: "center",
  },
  baseLine: {
    width: "100%",
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
  },
  readRange: {
    position: "absolute",
    top: "50%",
    marginTop: -(TRACK_H / 2),
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: READ_FILL,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: READ_NEW_TESTAMENT_ACCENT,
    borderWidth: 1.5,
    borderColor: READ_NEW_TESTAMENT_ACCENT,
  },
});
