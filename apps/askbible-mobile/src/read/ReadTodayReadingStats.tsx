import type { ComponentProps } from "react";
import { StyleSheet, View, type StyleProp, type TextStyle } from "react-native";
import { t } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { READ_NEW_TESTAMENT_ACCENT } from "@/lib/read/canon-section-theme";
import type { ReadingHabitStatsSnapshot } from "./reading-habit-stats";
import { ReadUiScaledText } from "./ReadUiScaledText";

function Text(props: ComponentProps<typeof ReadUiScaledText>) {
  return <ReadUiScaledText {...props} sizeBump={1} />;
}

const READ_DONE_ACCENT = "#65775C";

type Props = {
  yearDay: number;
  snapshot: ReadingHabitStatsSnapshot;
};

function StatBlock({
  value,
  label,
  valueStyle,
}: {
  value: string;
  label: string;
  valueStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, valueStyle]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function ReadTodayReadingStats({ yearDay, snapshot }: Props) {
  const readStr = snapshot.readDays.toLocaleString();
  const streakStr = snapshot.streakDays.toLocaleString();
  const yearStr = yearDay.toLocaleString();

  return (
    <View style={styles.row} accessibilityRole="summary">
      <StatBlock value={yearStr} label={t("pages.read.todayReadingStatYearDayLabel")} />
      <View style={styles.divider} />
      <StatBlock
        value={readStr}
        label={t("pages.read.todayReadingStatReadLabel")}
        valueStyle={styles.statValueReadDone}
      />
      <View style={styles.divider} />
      <StatBlock
        value={streakStr}
        label={t("pages.read.todayReadingStatStreakLabel")}
        valueStyle={styles.statValueReadDone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    width: "100%",
    marginTop: 10,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 0,
  },
  statValue: {
    fontSize: 38,
    lineHeight: 44,
    ...parchmentSans(700),
    color: READ_NEW_TESTAMENT_ACCENT,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  statValueReadDone: {
    color: READ_DONE_ACCENT,
  },
  statLabel: {
    fontSize: 14,
    lineHeight: 18,
    ...parchmentSans(500),
    color: c.faint,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: 2,
    backgroundColor: c.border,
  },
});
