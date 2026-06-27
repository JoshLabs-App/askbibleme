import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { readAheadDays, resetReadingPlanAheadToToday } from "./reading-plan/reading-plan-ahead";
import type { TodayReadingPlanState } from "./useTodayReadingPlan";

type Props = {
  plan: TodayReadingPlanState;
};

export function ReadTodayPlanAheadControls({ plan }: Props) {
  const { prefs } = plan;
  const aheadDays = readAheadDays(prefs);
  const [busy, setBusy] = useState(false);

  if (aheadDays <= 0) return null;

  const run = (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    void fn().finally(() => setBusy(false));
  };

  return (
    <View style={styles.row}>
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
