import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { InteractionManager, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocale } from "../i18n/LocaleProvider";
import { t, tFormat } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { ReadingPlanStartDayPicker } from "./ReadingPlanStartDayPicker";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { isNtDeepRepeatPlanId } from "./reading-plan/nt-deep-repeat-plan";
import { activateNtDeepRepeatPlan } from "./reading-plan/nt-deep-repeat-plan-sync";
import {
  NT_DEEP_REPEAT_DEFAULT_PACE,
  type NtDeepRepeatPace,
} from "./reading-plan/nt-deep-repeat-pace";
import { NtDeepRepeatPaceSection } from "./NtDeepRepeatPaceSection";
import { isPointerReadingPlanId } from "@/lib/bible/reading-plans/pointer-reading-plan";
import { isTripleLoopPlanId } from "./reading-plan/triple-loop-plan";
import { ensureTripleLoopPlanPrefs } from "./reading-plan/triple-loop-plan-sync";
import {
  DEFAULT_READING_PLAN_ANCHOR,
  DEFAULT_READING_PLAN_ID,
  type ReadingPlanAnchor,
  readReadingPlanPrefs,
  resolveReadingPlanDayIndex,
  setActiveReadingPlan,
  writeReadingPlanPrefs,
} from "./reading-plan/reading-plan-prefs";
import { resolveEffectiveEpochDay } from "./reading-plan/reading-plan-ahead";
import { useEffectiveReadingPlanPrefs } from "./reading-plan/useReadingPlanStores";
import { pushReadPlanPlay } from "./read-plan-flow-nav";

type Props = {
  planId: string;
  dayCount: number;
};

function maxStartDayForPlan(planId: string, dayCount: number, isNtDeepRepeat: boolean): number {
  if (isNtDeepRepeat) return 365;
  return Math.max(1, Number.isFinite(dayCount) ? dayCount : 365);
}

export function ReadPlanActivateControl({ planId, dayCount }: Props) {
  const router = useRouter();
  const { locale } = useLocale();
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
  const maxStartDay = maxStartDayForPlan(planId, dayCount, isNtDeepRepeat);
  const supportsStartDay =
    isNtDeepRepeat || (!isPointerPlan && !isTripleLoop && anchor === "from-today");
  const [startDay, setStartDay] = useState(1);

  useEffect(() => {
    if (isActive) setAnchor(effective.anchor);
  }, [isActive, effective.anchor]);

  useEffect(() => {
    if (isActive && effective.ntDeepRepeatPace) setPace(effective.ntDeepRepeatPace);
    else if (stored?.ntDeepRepeatPace) setPace(stored.ntDeepRepeatPace);
  }, [isActive, effective.ntDeepRepeatPace, stored?.ntDeepRepeatPace]);

  const currentPlanDay = useMemo(() => {
    if (!isActive) return null;
    if (isNtDeepRepeat) return resolveEffectiveEpochDay(effective);
    if (isTripleLoop) return null;
    return resolveReadingPlanDayIndex(effective, dayCount) + 1;
  }, [isActive, effective, dayCount, isNtDeepRepeat, isTripleLoop]);

  useEffect(() => {
    if (!supportsStartDay) return;
    if (isActive && currentPlanDay != null) {
      setStartDay(Math.min(maxStartDay, Math.max(1, currentPlanDay)));
    }
  }, [supportsStartDay, isActive, currentPlanDay, maxStartDay]);

  const activate = async () => {
    const safeStartDay = Math.min(maxStartDay, Math.max(1, Math.floor(startDay)));
    if (isNtDeepRepeat) {
      await activateNtDeepRepeatPlan({ dayCount, pace, startDay: safeStartDay });
    } else if (isTripleLoop) {
      await ensureTripleLoopPlanPrefs();
    } else if (supportsStartDay) {
      const backDated = new Date();
      backDated.setDate(backDated.getDate() - (safeStartDay - 1));
      await setActiveReadingPlan(planId, anchor, { dayCount, now: backDated });
    } else {
      await setActiveReadingPlan(planId, anchor, { dayCount });
    }
    refresh();
    void readReadingPlanPrefs().then(setStored);
    if (!isActive) {
      pushReadPlanPlay(router);
    }
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

      {supportsStartDay ? (
        <ReadingPlanStartDayPicker
          locale={locale}
          value={startDay}
          max={maxStartDay}
          onChange={setStartDay}
        />
      ) : null}

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
        {isActive && currentPlanDay != null ? (
          <Text style={styles.dayMeta}>
            {tFormat("pages.read.planActivateCurrentDay", { n: currentPlanDay })}
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
