import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { t, tFormat } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { useLocale } from "../i18n/LocaleProvider";
import type { ReadingPlanRegistryEntry } from "./reading-plan/types";
import { computeTodayReadingItemProgress } from "./reading-plan/compute-today-reading-progress";
import { todayReadingItemKey } from "./reading-plan/today-reading-done";
import { planTitleKey, useTodayReadingPlan, type TodayReadingPlanState } from "./useTodayReadingPlan";
import { useTodayReadingDone } from "./useTodayReadingDone";
import { ReadTodayPlanReadingRow } from "./ReadTodayPlanReadingRow";
import { ReadTodayReadingStats } from "./ReadTodayReadingStats";
import { ReadYearDayTimeline } from "./ReadYearDayTimeline";
import { useReadingHabitStats } from "./useReadingHabitStats";
import { useTodayReadingChapterFractions } from "./useTodayReadingChapterFractions";
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
  const { isDone, allDone, toggleDone, doneKeys } = useTodayReadingDone(plan);
  const { fractions, tripleCurrent, tripleProgressKey } = useTodayReadingChapterFractions(plan);
  const { yearDay, snapshot, syncTodayComplete } = useReadingHabitStats();
  const { isTripleLoop } = plan;
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
    reload();
    const unsub = subscribeReadChapterCompletion(reload);
    return () => {
      cancelled = true;
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
      progressByItem.set(todayReadingItemKey(r), total > 0 ? completed / total : 0);
    }
    return progressByItem;
  }, [completedChapterKeys, isTripleLoop, readings]);

  const isReadingDone = useMemo(() => {
    const doneByItem = new Map<string, boolean>();
    for (const r of readings) {
      const itemKey = todayReadingItemKey(r);
      doneByItem.set(itemKey, isTripleLoop ? isDone(r) : (chapterCompletionProgress.get(itemKey) ?? 0) >= 1);
    }
    return doneByItem;
  }, [chapterCompletionProgress, isDone, isTripleLoop, readings]);

  const todayAllDone = useMemo(
    () =>
      !loading &&
      readings.length > 0 &&
      (isTripleLoop
        ? allDone(readings)
        : readings.every((r) => (chapterCompletionProgress.get(todayReadingItemKey(r)) ?? 0) >= 1)),
    [loading, readings, isTripleLoop, allDone, chapterCompletionProgress],
  );

  useEffect(() => {
    void syncTodayComplete(todayAllDone);
  }, [todayAllDone, syncTodayComplete]);

  const progressKey = `${[...doneKeys].join(",")}|${tripleProgressKey}|${JSON.stringify(fractions)}`;

  return (
    <View style={styles.readingsSection}>
      <View style={styles.readingsBlock}>
        <ReadYearDayTimeline />
        <ReadTodayReadingStats yearDay={yearDay} snapshot={snapshot} />

        {loading ? (
          <ActivityIndicator color={c.muted} style={styles.loader} />
        ) : readings.length ? (
          <View style={styles.readings}>
            {readings.map((r, idx) => {
              const done = isReadingDone.get(todayReadingItemKey(r)) ?? false;
              const itemKey = todayReadingItemKey(r);
              const chapterProgress = chapterCompletionProgress.get(itemKey) ?? 0;
              const progress = computeTodayReadingItemProgress({
                reading: r,
                isDone: done,
                chapterFraction: isTripleLoop ? (fractions[itemKey] ?? 0) : chapterProgress,
                isTripleLoop,
                currentTriple: tripleCurrent,
              });
              return (
                <ReadTodayPlanReadingRow
                  key={`${itemKey}-${progressKey}`}
                  reading={r}
                  done={done}
                  progress={progress}
                  showCheckbox={isTripleLoop}
                  dimDoneText={isTripleLoop}
                  checkboxDisabled={!isTripleLoop}
                  onToggleDone={isTripleLoop ? () => void toggleDone(r) : () => {}}
                  onOpen={() => onOpenChapter(r.bookId, r.startChapter, { planFlow: true })}
                />
              );
            })}
          </View>
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
  const { prefs, payload, loading, isTripleLoop, dayIndex, epochDay } = plan;

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

      {isTripleLoop ? (
        <Text style={styles.meta} maxFontSizeMultiplier={1.1}>
          {tFormat("pages.read.todayPlanDayMeta", { n: epochDay })}
          <Text style={styles.metaDot}> · </Text>
          {t("pages.read.todayPlanAnchorEaster")}
        </Text>
      ) : dayIndex != null ? (
        <Text style={styles.meta} maxFontSizeMultiplier={1.1}>
          {tFormat("pages.read.todayPlanDayMeta", { n: dayIndex + 1 })}
          <Text style={styles.metaDot}> · </Text>
          {anchorHint}
        </Text>
      ) : null}

      <View style={styles.links}>
        <Pressable onPress={() => router.push("/read/plans")} hitSlop={8}>
          <Text style={styles.link} maxFontSizeMultiplier={1.1}>
            {locale === "en" ? "Tap to view more plans" : "点击查看更多计划"}
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
