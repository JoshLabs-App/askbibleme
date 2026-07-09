import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, InteractionManager, Pressable, StyleSheet, Text, View } from "react-native";
import { t, tFormat } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { useLocale } from "../i18n/LocaleProvider";
import type { ReadingPlanRegistryEntry } from "./reading-plan/types";
import { todayReadingItemKey } from "./reading-plan/today-reading-done";
import { planTitleKey, useTodayReadingPlan, type TodayReadingPlanState } from "./useTodayReadingPlan";
import { useTodayReadingDone } from "./useTodayReadingDone";
import { ReadTodayPlanAheadControls } from "./ReadTodayPlanAheadControls";
import { ReadTodayPlanReadingRow } from "./ReadTodayPlanReadingRow";
import { READING_HABIT_MIN_FRACTION } from "./reading-habit-stats";
import { ReadTodayReadingStats } from "./ReadTodayReadingStats";
import { ReadYearDayTimeline } from "./ReadYearDayTimeline";
import { useReadingHabitStats } from "./useReadingHabitStats";
import { useTodayReadingChapterFractions } from "./useTodayReadingChapterFractions";
import { isNtDeepRepeatTodayReadingItemComplete } from "./reading-plan/nt-deep-repeat-today-reading-complete";
import { isTripleLoopTodayReadingItemComplete } from "./reading-plan/triple-loop-today-reading-complete";
import {
  useNtDeepRepeatProgress,
  useTripleLoopProgress,
} from "./reading-plan/useReadingPlanStores";
import {
  readCompletedChapterKeySet,
  subscribeReadChapterCompletion,
} from "./read-chapter-completion";

type ReadingsProps = {
  plan: TodayReadingPlanState;
  onOpenChapter: (bookId: string, chapter: number, opts?: { planFlow?: boolean }) => void;
};

/** 今日读经：年日轴 + 统计 + 今日章节 */
export function ReadTodayPlanReadings({ plan, onOpenChapter }: ReadingsProps) {
  const { payload, loading } = plan;
  const { isDone, toggleDone } = useTodayReadingDone(plan);
  const { fractions } = useTodayReadingChapterFractions(plan);
  const { progress: tripleProgress } = useTripleLoopProgress();
  const { progress: ntDeepProgress } = useNtDeepRepeatProgress();
  const { yearDay, snapshot, syncTodayComplete } = useReadingHabitStats();
  const { isTripleLoop, isNtDeepRepeat } = plan;
  const readings = payload?.day?.readings ?? [];
  const [completedChapterKeys, setCompletedChapterKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const reload = () => {
      void readCompletedChapterKeySet().then((keys) => {
        if (cancelled) return;
        setCompletedChapterKeys(keys);
      });
    };
    const task = InteractionManager.runAfterInteractions(reload);
    const unsub = subscribeReadChapterCompletion(reload);
    return () => {
      cancelled = true;
      task.cancel();
      unsub();
    };
  }, []);

  const chapterCompletionProgress = useMemo(() => {
    const progressByItem = new Map<string, number>();
    if (isTripleLoop) return progressByItem;
    for (const r of readings) {
      const start = Math.max(1, Math.trunc(r.startChapter));
      const end = Math.max(start, Math.trunc(r.endChapter));
      const total = end - start + 1;
      let completed = 0;
      for (let ch = start; ch <= end; ch += 1) {
        if (completedChapterKeys.has(`${r.bookId}:${ch}`)) completed += 1;
      }
      progressByItem.set(todayReadingItemKey(r, plan.prefs.planId), total > 0 ? completed / total : 0);
    }
    return progressByItem;
  }, [completedChapterKeys, isTripleLoop, readings, plan.prefs.planId]);

  const isReadingDone = useMemo(() => {
    const doneByItem = new Map<string, boolean>();
    for (const r of readings) {
      const itemKey = todayReadingItemKey(r, plan.prefs.planId);
      const fraction = fractions[itemKey] ?? 0;
      doneByItem.set(
        itemKey,
        isTripleLoop
          ? isTripleLoopTodayReadingItemComplete({
              reading: r,
              isDone: isDone(r),
              fraction,
              progress: tripleProgress,
            })
          : isNtDeepRepeat
            ? isNtDeepRepeatTodayReadingItemComplete({
                reading: r,
                isDone: isDone(r),
                fraction,
                progress: ntDeepProgress,
                chapterCompletionFraction: chapterCompletionProgress.get(itemKey) ?? 0,
              })
            : (chapterCompletionProgress.get(itemKey) ?? 0) >= 1,
      );
    }
    return doneByItem;
  }, [chapterCompletionProgress, fractions, isDone, isTripleLoop, isNtDeepRepeat, readings, tripleProgress, ntDeepProgress, plan.prefs.planId]);

  const todayHasReading = useMemo((): boolean | undefined => {
    if (loading) return undefined;
    if (readings.length === 0) return undefined;
    return readings.some((r) => {
      const itemKey = todayReadingItemKey(r, plan.prefs.planId);
      if (isReadingDone.get(itemKey)) return true;
      return (fractions[itemKey] ?? 0) >= READING_HABIT_MIN_FRACTION;
    });
  }, [loading, readings, isReadingDone, fractions]);

  useEffect(() => {
    if (todayHasReading !== true) return;
    void syncTodayComplete(true);
  }, [todayHasReading, syncTodayComplete]);

  return (
    <View style={styles.readingsSection}>
      <View style={styles.readingsBlock}>
        <ReadYearDayTimeline />
        <ReadTodayReadingStats yearDay={yearDay} snapshot={snapshot} />

        {loading ? (
          <ActivityIndicator color={c.muted} style={styles.loader} />
        ) : readings.length ? (
          <>
            <Text style={styles.todayReadingsTitle} maxFontSizeMultiplier={1.1}>
              {t("pages.read.todayPlanTitle")}
            </Text>
            <View style={styles.readings}>
            {readings.map((r) => {
              const done = isReadingDone.get(todayReadingItemKey(r, plan.prefs.planId)) ?? false;
              const itemKey = todayReadingItemKey(r, plan.prefs.planId);
              const showPlanCheckbox = isTripleLoop || isNtDeepRepeat;
              return (
                <ReadTodayPlanReadingRow
                  key={itemKey}
                  reading={r}
                  done={done}
                  showCheckbox={showPlanCheckbox}
                  dimDoneText={showPlanCheckbox}
                  checkboxDisabled={!isTripleLoop}
                  onToggleDone={isTripleLoop ? () => void toggleDone(r) : () => {}}
                  onOpen={() => onOpenChapter(r.bookId, r.startChapter, { planFlow: true })}
                />
              );
            })}
            </View>
            <ReadTodayPlanAheadControls plan={plan} />
          </>
        ) : (
          <Text style={styles.empty} maxFontSizeMultiplier={1.1}>
            {t("pages.read.todayPlanEmpty")}
          </Text>
        )}
      </View>
    </View>
  );
}

type FooterProps = {
  plan: TodayReadingPlanState;
};

/** 读经计划元信息：放在目录页最底部 */
export function ReadTodayPlanFooter({ plan }: FooterProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const { prefs, payload, loading, isTripleLoop, isNtDeepRepeat, isPointerPlan, dayIndex, aheadDays, effectiveEpochDay } = plan;

  const titleKey = planTitleKey(prefs.planId);
  const localizedTitle = t(titleKey);
  const planTitle = localizedTitle === titleKey ? payload?.name ?? prefs.planId : localizedTitle;
  const anchorHint =
    prefs.anchor === "calendar-jan1" ? t("pages.read.todayPlanAnchorJan1") : t("pages.read.todayPlanAnchorToday");

  if (loading) return null;

  return (
    <View style={styles.footerSection}>
      <Text style={styles.planTitle} maxFontSizeMultiplier={1.1}>
        {planTitle}
      </Text>

      {isTripleLoop || isNtDeepRepeat ? (
        <Text style={styles.meta} maxFontSizeMultiplier={1.1}>
          {tFormat("pages.read.todayPlanDayMeta", { n: effectiveEpochDay })}
          <Text style={styles.metaDot}> · </Text>
          {aheadDays > 0
            ? t("pages.read.todayPlanAheadLabel")
            : isNtDeepRepeat
              ? t("pages.read.todayPlanAnchorToday")
              : t("pages.read.todayPlanAnchorEaster")}
        </Text>
      ) : dayIndex != null ? (
        <Text style={styles.meta} maxFontSizeMultiplier={1.1}>
          {tFormat("pages.read.todayPlanDayMeta", { n: dayIndex + 1 + aheadDays })}
          <Text style={styles.metaDot}> · </Text>
          {aheadDays > 0 ? t("pages.read.todayPlanAheadLabel") : anchorHint}
        </Text>
      ) : null}

      <View style={styles.links}>
        <Pressable onPress={() => router.push("/read/plans")} hitSlop={8}>
          <Text style={styles.link} maxFontSizeMultiplier={1.1}>
            {locale === "en"
              ? "Tap to view more plans"
              : locale === "zh-TW"
                ? "點按查看更多計畫"
                : "点击查看更多计划"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

type PanelProps = {
  registryPlans: ReadingPlanRegistryEntry[];
  onOpenChapter: (bookId: string, chapter: number, opts?: { planFlow?: boolean }) => void;
};

export function ReadTodayPlanPanel({ registryPlans, onOpenChapter }: PanelProps) {
  const plan = useTodayReadingPlan(registryPlans);
  return (
    <>
      <ReadTodayPlanReadings plan={plan} onOpenChapter={onOpenChapter} />
      <ReadTodayPlanFooter plan={plan} />
    </>
  );
}

const styles = StyleSheet.create({
  readingsSection: {
    marginTop: 6,
    paddingTop: 2,
    width: "100%",
    alignItems: "center",
  },
  readingsBlock: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 340,
    marginLeft: 0,
    alignItems: "stretch",
  },
  loader: { marginTop: 10, alignSelf: "flex-start" },
  todayReadingsTitle: {
    width: "100%",
    marginTop: 6,
    marginBottom: 2,
    paddingLeft: 30,
    fontSize: 14,
    letterSpacing: 0.6,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "left",
  },
  readings: {
    marginTop: 2,
    width: "100%",
    paddingLeft: 30,
    gap: 0,
  },
  empty: {
    width: "100%",
    marginTop: 8,
    fontSize: 13,
    color: c.muted,
    textAlign: "left",
  },
  footerSection: {
    marginTop: 28,
    paddingTop: 20,
    alignItems: "center",
    paddingBottom: 8,
  },
  planTitle: {
    maxWidth: 320,
    fontSize: 15,
    ...parchmentSans(500),
    lineHeight: 20,
    color: c.muted,
    textAlign: "center",
  },
  meta: {
    marginTop: 6,
    fontSize: 12,
    letterSpacing: 0.4,
    color: c.faint,
    textAlign: "center",
  },
  metaDot: { color: c.faint },
  links: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  link: {
    fontSize: 12,
    ...parchmentSans(500),
    color: c.muted,
  },
  pressed: { opacity: 0.88 },
});
