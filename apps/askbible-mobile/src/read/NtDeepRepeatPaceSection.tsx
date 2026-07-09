import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { t, tFormat } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  NT_DEEP_REPEAT_PACE_OPTIONS,
  buildNtDeepRepeatPaceTimeline,
  firstSegmentDayCount,
  firstSegmentEndDate,
  formatApproxDurationEn,
  formatApproxDurationZh,
  type NtDeepRepeatPace,
} from "./reading-plan/nt-deep-repeat-pace";

type Props = {
  value?: NtDeepRepeatPace;
  onChange?: (pace: NtDeepRepeatPace) => void;
  previewStart?: Date;
  locale?: string;
};

function paceSummaryKey(pace: NtDeepRepeatPace): string {
  return `pages.read.ntDeepRepeatPace${pace}Summary`;
}

function paceTitleKey(pace: NtDeepRepeatPace): string {
  if (pace === 7) return "pages.read.ntDeepRepeatPace7Title";
  if (pace === 14) return "pages.read.ntDeepRepeatPace14Title";
  return "pages.read.ntDeepRepeatPace28Title";
}

function formatDuration(days: number, locale: string): string {
  return locale === "en" ? formatApproxDurationEn(days) : formatApproxDurationZh(days);
}

function formatEndDate(d: Date, locale: string): string {
  return d.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

export function NtDeepRepeatPaceSection({ value, onChange, previewStart, locale = "zh-CN" }: Props) {
  const [internalPace, setInternalPace] = useState<NtDeepRepeatPace>(NT_DEEP_REPEAT_DEFAULT_PACE);
  const pace = value ?? internalPace;
  const start = previewStart ?? new Date();

  const setPace = (next: NtDeepRepeatPace) => {
    if (onChange) onChange(next);
    else setInternalPace(next);
  };

  const timeline = useMemo(() => buildNtDeepRepeatPaceTimeline(pace, start), [pace, start]);
  const firstDays = firstSegmentDayCount(start, pace);
  const firstEnd = firstSegmentEndDate(start, pace);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t("pages.read.ntDeepRepeatPaceTitle")}</Text>
      <Text style={styles.intro}>{t("pages.read.ntDeepRepeatPaceIntro")}</Text>
      <Text style={styles.note}>{t("pages.read.ntDeepRepeatPaceContinuousNote")}</Text>

      {NT_DEEP_REPEAT_PACE_OPTIONS.map((option) => (
        <Pressable
          key={option}
          onPress={() => setPace(option)}
          style={[styles.option, pace === option && styles.optionOn]}
        >
          <View style={[styles.radio, pace === option && styles.radioOn]} />
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>{t(paceTitleKey(option))}</Text>
            <Text style={styles.optionMeta}>{t(paceSummaryKey(option))}</Text>
          </View>
        </Pressable>
      ))}

      <Text style={styles.firstNote}>
        {tFormat("pages.read.ntDeepRepeatPaceFirstSegmentNote", {
          days: String(firstDays),
          nextDay: String(firstDays + 1),
          endDate: formatEndDate(firstEnd, locale),
        })}
      </Text>

      <View style={styles.table}>
        <Text style={styles.tableHead}>{t("pages.read.ntDeepRepeatPaceTimelineHeader")}</Text>
        {timeline.passRows.map((row) => (
          <View key={row.depthDays} style={styles.tableRow}>
            <Text style={styles.tablePass}>{t(paceSummaryKey(row.depthDays))}</Text>
            <Text style={styles.tableDuration}>{formatDuration(row.days, locale)}</Text>
          </View>
        ))}
        <Text style={styles.tableFoot}>
          {tFormat("pages.read.ntDeepRepeatPaceOtNote", {
            years: timeline.otPassApproxYears.toFixed(1),
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 16, gap: 10 },
  title: {
    fontSize: 11,
    ...parchmentSans(600),
    letterSpacing: 1.2,
    color: c.faint,
  },
  intro: { fontSize: 12, lineHeight: 18, color: c.muted },
  note: { fontSize: 11, lineHeight: 16, color: c.faint },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionOn: { backgroundColor: "rgba(255, 252, 245, 0.65)" },
  radio: {
    marginTop: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: c.muted,
  },
  radioOn: { borderWidth: 5, borderColor: c.ink },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 13, ...parchmentSans(500), color: c.ink },
  optionMeta: { marginTop: 4, fontSize: 11, lineHeight: 16, color: c.muted },
  firstNote: { fontSize: 11, lineHeight: 16, color: c.faint },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  tableHead: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 11,
    ...parchmentSans(500),
    color: c.faint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.45)",
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  tablePass: { fontSize: 12, color: c.ink },
  tableDuration: { fontSize: 12, color: c.muted, fontVariant: ["tabular-nums"] },
  tableFoot: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 11,
    lineHeight: 16,
    color: c.faint,
  },
});
