import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { InteractionManager, Pressable, StyleSheet, Text, View } from "react-native";
import { t, tFormat } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { isNtDeepRepeatPlanId } from "./reading-plan/nt-deep-repeat-plan";
import { activateNtDeepRepeatPlan } from "./reading-plan/nt-deep-repeat-plan-sync";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  type NtDeepRepeatPace,
} from "./reading-plan/nt-deep-repeat-pace";
import { NtDeepRepeatPaceSection } from "./NtDeepRepeatPaceSection";
import { isPointerReadingPlanId } from "./reading-plan/pointer-reading-plan";
import { isTripleLoopPlanId } from "./reading-plan/triple-loop-plan";
import {
  DEFAULT_READING_PLAN_ANCHOR,
  DEFAULT_READING_PLAN_ID,
  type ReadingPlanAnchor,
  readReadingPlanPrefs,
  resolveReadingPlanDayIndex,
  setActiveReadingPlan,
  writeReadingPlanPrefs,
} from "./reading-plan/reading-plan-prefs";
import { useEffectiveReadingPlanPrefs } from "./reading-plan/useReadingPlanStores";

type Props = {
  planId: string;
  dayCount: number;
};

export function ReadPlanActivateControl({ planId, dayCount }: Props) {
  const router = useRouter();
  const { prefs: effective, refresh } = useEffectiveReadingPlanPrefs();
  const [stored, setStored] = useState<Awaited<ReturnType<typeof readReadingPlanPrefs>>>(null);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void readReadingPlanPrefs().then(setStored);
    });
    return () => task.cancel();
  }, [effective]);

  const isTripleLoop = isTripleLoopPlanId(planId);
  const isNtDeepRepeat = isNtDeepRepeatPlanId(planId);
  const isPointerPlan = isPointerReadingPlanId(planId);
  const isActive = effective.planId === planId;
  const isImplicitDefault = planId === DEFAULT_READING_PLAN_ID && stored === null;
  const [anchor, setAnchor] = useState<ReadingPlanAnchor>(
    stored?.planId === planId
      ? stored.anchor
      : planId === DEFAULT_READING_PLAN_ID
        ? DEFAULT_READING_PLAN_ANCHOR
        : "from-today",
  );

  const [pace, setPace] = useState<NtDeepRepeatPace>(
    stored?.ntDeepRepeatPace ?? effective.ntDeepRepeatPace ?? NT_DEEP_REPEAT_DEFAULT_PACE,
  );

  useEffect(() => {
    if (isActive) setAnchor(effective.anchor);
  }, [isActive, effective.anchor]);

  useEffect(() => {
    if (isActive && effective.ntDeepRepeatPace) setPace(effective.ntDeepRepeatPace);
    else if (stored?.ntDeepRepeatPace) setPace(stored.ntDeepRepeatPace);
  }, [isActive, effective.ntDeepRepeatPace, stored?.ntDeepRepeatPace]);

  const todayDayIndex = useMemo(() => {
    if (!isActive || isPointerPlan) return null;
    return resolveReadingPlanDayIndex(effective, dayCount) + 1;
  }, [isActive, effective, dayCount, isPointerPlan]);

  const activate = async () => {
    if (isNtDeepRepeat) {
      await activateNtDeepRepeatPlan({ dayCount, pace });
    } else {
      await setActiveReadingPlan(planId, isTripleLoop ? "calendar-easter" : anchor, { dayCount });
    }
    refresh();
    router.replace("/read");
  };

  const clear = async () => {
    await writeReadingPlanPrefs(null);
    refresh();
    void readReadingPlanPrefs().then(setStored);
  };

  return (
    <View style={styles.box}>
      <Text style={styles.heading}>{t("pages.read.planActivateHeading")}</Text>

      {isPointerPlan ? (
        isNtDeepRepeat ? (
          <>
            <Text style={styles.hint}>{t("pages.read.ntDeepRepeatActivateHint")}</Text>
            <NtDeepRepeatPaceSection value={pace} onChange={setPace} />
          </>
        ) : (
          <Text style={styles.hint}>{t("pages.read.tripleLoopActivateHint")}</Text>
        )
      ) : (
        <View style={styles.anchors}>
          <Pressable onPress={() => setAnchor("from-today")} style={styles.anchorRow}>
            <View style={[styles.radio, anchor === "from-today" && styles.radioOn]} />
            <View style={styles.anchorText}>
              <Text style={styles.anchorTitle}>{t("pages.read.planAnchorFromToday")}</Text>
              <Text style={styles.anchorHint}>{t("pages.read.planAnchorFromTodayHint")}</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => setAnchor("calendar-jan1")} style={styles.anchorRow}>
            <View style={[styles.radio, anchor === "calendar-jan1" && styles.radioOn]} />
            <View style={styles.anchorText}>
              <Text style={styles.anchorTitle}>{t("pages.read.planAnchorJan1")}</Text>
              <Text style={styles.anchorHint}>{t("pages.read.planAnchorJan1Hint")}</Text>
            </View>
          </Pressable>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable onPress={() => void activate()} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>
            {isActive ? t("pages.read.planActivateUpdate") : t("pages.read.planActivateUse")}
          </Text>
        </Pressable>
        {isActive && !isImplicitDefault ? (
          <Pressable onPress={() => void clear()} hitSlop={8}>
            <Text style={styles.clear}>{t("pages.read.planActivateClear")}</Text>
          </Pressable>
        ) : null}
        {isActive && todayDayIndex != null ? (
          <Text style={styles.dayMeta}>
            {tFormat("pages.read.planActivateCurrentDay", { n: todayDayIndex })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "rgba(255, 252, 245, 0.5)",
  },
  heading: {
    fontSize: 11,
    ...parchmentSans(600),
    letterSpacing: 1.2,
    color: c.faint,
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 18,
    color: c.muted,
  },
  anchors: { marginTop: 12, gap: 12 },
  anchorRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  radio: {
    marginTop: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: c.muted,
  },
  radioOn: { borderWidth: 5, borderColor: c.ink },
  anchorText: { flex: 1 },
  anchorTitle: { fontSize: 13, ...parchmentSans(500), color: c.ink },
  anchorHint: { marginTop: 4, fontSize: 11, lineHeight: 16, color: c.muted },
  actions: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  primary: {
    borderRadius: 8,
    backgroundColor: c.ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryText: { fontSize: 12, ...parchmentSans(600), color: "#f5efe4" },
  clear: {
    fontSize: 12,
    ...parchmentSans(500),
    color: c.muted,
    textDecorationLine: "underline",
  },
  dayMeta: { fontSize: 11, color: c.faint },
  pressed: { opacity: 0.9 },
});
