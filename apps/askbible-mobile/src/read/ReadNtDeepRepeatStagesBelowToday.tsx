import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { parchmentSans } from "../fonts/parchmentType";
import { t, tFormat } from "../i18n/site-copy";
import { readParchmentTheme as c } from "./readParchmentTheme";
import {
  NT_DEEP_REPEAT_CURRICULUM,
  ntDeepRepeatSegmentKey,
} from "./reading-plan/nt-deep-repeat-curriculum";
import { ntDeepRepeatOneCycleDays } from "./reading-plan/nt-deep-repeat-pace";
import { setNtDeepRepeatCurriculumStageAsToday } from "./reading-plan/nt-deep-repeat-progress";
import {
  formatNtDeepRepeatSegmentStageRange,
} from "./reading-plan/nt-deep-repeat-reading";
import { useNtDeepRepeatProgress } from "./reading-plan/useReadingPlanStores";

type Props = {
  /** 设为今日后回调（刷新今日列表等） */
  onStageSet?: () => void;
};

/**
 * 正式研经计划：今日读经列表下方的 52 版块；点选可设为今日新约读经。
 */
export function ReadNtDeepRepeatStagesBelowToday({ onStageSet }: Props) {
  const { progress, refresh } = useNtDeepRepeatProgress();
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const stageCount = NT_DEEP_REPEAT_CURRICULUM.length;
  const cycleDays = ntDeepRepeatOneCycleDays(
    progress.pace,
    progress.startedAt ? new Date(`${progress.startedAt}T12:00:00`) : new Date(),
  );

  const applyStage = useCallback(
    async (index: number) => {
      if (busyIndex != null) return;
      setBusyIndex(index);
      try {
        await setNtDeepRepeatCurriculumStageAsToday(index);
        refresh();
        onStageSet?.();
      } finally {
        setBusyIndex(null);
      }
    },
    [busyIndex, onStageSet, refresh],
  );

  const onPressStage = useCallback(
    (index: number, rangeLabel: string) => {
      if (index === progress.curriculumIndex) return;
      Alert.alert(
        t("pages.read.ntDeepRepeatSetStageAsTodayTitle"),
        tFormat("pages.read.ntDeepRepeatSetStageAsTodayBody", {
          n: String(index + 1),
          range: rangeLabel,
        }),
        [
          { text: t("pages.read.ntDeepRepeatSetStageAsTodayCancel"), style: "cancel" },
          {
            text: t("pages.read.ntDeepRepeatSetStageAsTodayConfirm"),
            onPress: () => void applyStage(index),
          },
        ],
      );
    },
    [applyStage, progress.curriculumIndex],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("pages.read.ntDeepRepeatLadderTitle")}</Text>
      <Text style={styles.lead}>
        {tFormat("pages.read.ntDeepRepeatLadderLead", {
          stages: String(stageCount),
          days: String(progress.pace),
          cycle: String(cycleDays),
        })}
      </Text>
      <Text style={styles.hint}>{t("pages.read.ntDeepRepeatStagesBelowHint")}</Text>
      <View style={styles.list}>
        {NT_DEEP_REPEAT_CURRICULUM.map((segment, index) => {
          const isCurrent = index === progress.curriculumIndex;
          const rangeLabel = formatNtDeepRepeatSegmentStageRange(segment);
          const busy = busyIndex === index;
          return (
            <Pressable
              key={ntDeepRepeatSegmentKey(segment)}
              onPress={() => onPressStage(index, rangeLabel)}
              disabled={busy || busyIndex != null}
              style={({ pressed }) => [
                styles.row,
                isCurrent && styles.rowCurrent,
                pressed && !isCurrent && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isCurrent, disabled: busy }}
              accessibilityLabel={`${tFormat("pages.read.ntDeepRepeatStageLabel", { n: String(index + 1) })} ${rangeLabel}`}
            >
              <Text style={[styles.stage, isCurrent && styles.stageCurrent]}>
                {tFormat("pages.read.ntDeepRepeatStageLabel", { n: String(index + 1) })}
              </Text>
              <View style={styles.body}>
                <Text style={[styles.range, isCurrent && styles.rangeCurrent]} numberOfLines={2}>
                  {rangeLabel}
                </Text>
                {isCurrent ? (
                  <Text style={styles.status}>
                    {tFormat("pages.read.ntDeepRepeatStageCurrent", {
                      day: String(progress.dayInSegment),
                      total: String(progress.segmentDayTarget || progress.pace),
                    })}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 28,
    marginBottom: 12,
    gap: 10,
  },
  title: {
    fontSize: 18,
    ...parchmentSans(600),
    letterSpacing: 0.3,
    color: c.ink,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: c.muted,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: c.faint,
    marginBottom: 4,
  },
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.35)",
  },
  rowCurrent: {
    backgroundColor: "rgba(255, 252, 245, 0.9)",
  },
  pressed: {
    opacity: 0.72,
  },
  stage: {
    width: 64,
    fontSize: 15,
    ...parchmentSans(600),
    color: c.faint,
    paddingTop: 2,
  },
  stageCurrent: {
    color: c.ink,
  },
  body: { flex: 1, gap: 4 },
  range: {
    fontSize: 18,
    lineHeight: 26,
    color: c.muted,
  },
  rangeCurrent: {
    ...parchmentSans(600),
    color: c.ink,
  },
  status: {
    fontSize: 14,
    lineHeight: 20,
    color: c.muted,
  },
});
