import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import {
  advanceReadingPlanOneDay,
  canAdvanceReadingPlanOneDay,
  readAheadDays,
  resetReadingPlanAheadToToday,
} from "./reading-plan/reading-plan-ahead";
import type { TodayReadingPlanState } from "./useTodayReadingPlan";

type Props = {
  plan: TodayReadingPlanState;
  todayAllDone: boolean;
};

export function ReadTodayPlanAheadControls({ plan, todayAllDone }: Props) {
  const { prefs, dayCount } = plan;
  const aheadDays = readAheadDays(prefs);
  const [busy, setBusy] = useState(false);

  const canAdvance = canAdvanceReadingPlanOneDay(prefs, dayCount) && todayAllDone;
  const showBack = aheadDays > 0;
  if (!canAdvance && !showBack) return null;

  const run = (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    void fn().finally(() => setBusy(false));
  };

  return (
    <View style={styles.row}>
      {showBack ? (
        <Pressable
          disabled={busy}
          onPress={() => run(() => resetReadingPlanAheadToToday())}
          hitSlop={8}
          style={({ pressed }) => [styles.wrap, pressed && styles.pressed, busy && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={t("pages.read.todayPlanBackToToday")}
        >
          <Text style={styles.text} maxFontSizeMultiplier={1.1}>
            <Text style={styles.chevron}>‹ </Text>
            {t("pages.read.todayPlanBackToToday")}
          </Text>
        </Pressable>
      ) : null}
      {canAdvance ? (
        <Pressable
          disabled={busy}
          onPress={() => run(() => advanceReadingPlanOneDay())}
          hitSlop={8}
          style={({ pressed }) => [styles.wrap, pressed && styles.pressed, busy && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={t("pages.read.todayPlanReadNextDay")}
        >
          <Text style={styles.text} maxFontSizeMultiplier={1.1}>
            {t("pages.read.todayPlanReadNextDay")}
            <Text style={styles.chevron}> ›</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 16,
    width: "100%",
    paddingRight: 0,
  },
  wrap: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  text: {
    fontSize: 12,
    ...parchmentSans(500),
    color: c.muted,
  },
  chevron: {
    ...parchmentSans(600),
    color: c.muted,
  },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.5 },
});
