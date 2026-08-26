import { useCallback, useEffect, useMemo, useState } from "react";
import { InteractionManager } from "react-native";
import { useLocale } from "../i18n/LocaleProvider";
import type { AppLocale } from "../i18n/config";
import { toZhTwText } from "../i18n/site-copy";
import { resolveReadChapterNeighbors } from "../bible/read-chapter-neighbors";
import { getReadingPlanDaySinceEpoch } from "./reading-plan/reading-plan-epoch";
import {
  readEffectiveReadingPlanPrefs,
  resolveReadingPlanDayIndex,
} from "./reading-plan/reading-plan-prefs";
import { loadTodayReadingPlanPayload } from "./reading-plan/today-reading-plan-payload";
import {
  buildTodayReadingScopeKey,
  readTodayReadingDoneKeys,
  setTodayReadingItemDone,
  subscribeTodayReadingDone,
  todayReadingItemKey,
} from "./reading-plan/today-reading-done";
import { isTodayReadingPlanItemComplete } from "./reading-plan/today-reading-chapter-fraction";
import type { ReadingPlanRange } from "./reading-plan/types";
import { isNtDeepRepeatPlanId } from "./reading-plan/nt-deep-repeat-plan";
import { isPointerReadingPlanId } from "./reading-plan/pointer-reading-plan";
import { isTripleLoopPlanId } from "./reading-plan/triple-loop-plan";
import { useEffectiveReadingPlanPrefs, useNtDeepRepeatProgress, useTripleLoopProgress } from "./reading-plan/useReadingPlanStores";
import { useMemberAuth } from "../auth/MemberAuthProvider";
import {
  markReadChapterCompleted,
  readCompletedChapterKeySet,
  subscribeReadChapterCompletion,
} from "./read-chapter-completion";
import {
  buildChapterQueue,
  expandReadingsToChapterRows,
  formatDisplayNickname,
  sameChapter,
  type ChapterRef,
} from "./readChapterCompletionPlanPanelHelpers";

type Params = {
  bookId: string;
  chapter: number;
  displayLocale?: AppLocale;
};

export function useReadChapterCompletionPlanState({ bookId, chapter, displayLocale }: Params) {
  const { locale } = useLocale();
  const effectiveLocale = displayLocale ?? locale;
  const isEnglishDisplay = effectiveLocale === "en";
  const { prefs } = useEffectiveReadingPlanPrefs();
  const { progress: tripleProgress } = useTripleLoopProgress();
  const { progress: ntDeepProgress } = useNtDeepRepeatProgress();
  const [readings, setReadings] = useState<ReadingPlanRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());
  const [completedChapterKeys, setCompletedChapterKeys] = useState<Set<string>>(new Set());
  const [scopeKey, setScopeKey] = useState<string | null>(null);
  const { user, bootstrapped } = useMemberAuth();

  const localeZhText = useCallback(
    (text: string) => (effectiveLocale === "zh-TW" ? toZhTwText(text) : text),
    [effectiveLocale],
  );

  const tripleProgressKey = isTripleLoopPlanId(prefs.planId)
    ? `${tripleProgress.ot.bookId}:${tripleProgress.ot.chapter}|${tripleProgress.nt.bookId}:${tripleProgress.nt.chapter}|${tripleProgress.wisdom.bookId}:${tripleProgress.wisdom.chapter}`
    : "";
  const ntDeepProgressKey = isNtDeepRepeatPlanId(prefs.planId)
    ? `${ntDeepProgress.ot.bookId}:${ntDeepProgress.ot.chapter}|i:${ntDeepProgress.curriculumIndex}|d:${ntDeepProgress.dayInSegment}`
    : tripleProgressKey;

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        setLoading(true);
        try {
          const effective = await readEffectiveReadingPlanPrefs();
          const payload = await loadTodayReadingPlanPayload(effective, { dayCount: effective.dayCount });
          if (cancelled) return;
          const key = buildTodayReadingScopeKey({
            planId: effective.planId,
            isTripleLoop: isTripleLoopPlanId(effective.planId),
            epochDay: getReadingPlanDaySinceEpoch(),
            dayIndex: isPointerReadingPlanId(effective.planId)
              ? null
              : resolveReadingPlanDayIndex(effective, effective.dayCount ?? 365),
          });
          setReadings(payload?.day?.readings ?? []);
          setScopeKey(key);
        } catch {
          if (cancelled) return;
          setReadings([]);
          setScopeKey(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [prefs.planId, prefs.anchor, prefs.startedOn, prefs.dayCount, ntDeepProgressKey]);

  const reloadDoneKeys = useCallback(async () => {
    if (!scopeKey) {
      setDoneKeys(new Set());
      return;
    }
    const next = await readTodayReadingDoneKeys(scopeKey);
    setDoneKeys(next);
  }, [scopeKey]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void reloadDoneKeys();
    });
    return () => task.cancel();
  }, [reloadDoneKeys]);

  useEffect(() => {
    const unsub = subscribeTodayReadingDone(() => {
      void reloadDoneKeys();
    });
    return unsub;
  }, [reloadDoneKeys]);

  const reloadCompletedChapterKeys = useCallback(async () => {
    const next = await readCompletedChapterKeySet();
    setCompletedChapterKeys(next);
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void reloadCompletedChapterKeys();
    });
    return () => task.cancel();
  }, [reloadCompletedChapterKeys]);

  useEffect(() => {
    const unsub = subscribeReadChapterCompletion(() => {
      void reloadCompletedChapterKeys();
    });
    return unsub;
  }, [reloadCompletedChapterKeys]);

  const isReadingDone = useCallback(
    (r: ReadingPlanRange) =>
      isTodayReadingPlanItemComplete(r, {
        itemKey: todayReadingItemKey(r, prefs.planId),
        doneKeys,
        completedChapterKeys,
      }),
    [completedChapterKeys, doneKeys, prefs.planId],
  );

  const chapterQueue = useMemo(() => buildChapterQueue(readings), [readings]);
  const chapterRows = useMemo(() => expandReadingsToChapterRows(readings), [readings]);
  const currentChapter = useMemo<ChapterRef>(() => ({ bookId, chapter }), [bookId, chapter]);
  const currentQueueIndex = useMemo(
    () => chapterQueue.findIndex((ref) => sameChapter(ref, currentChapter)),
    [chapterQueue, currentChapter],
  );
  const neighbors = useMemo(() => resolveReadChapterNeighbors(bookId, chapter), [bookId, chapter]);
  const nextTarget =
    currentQueueIndex >= 0 && chapterQueue.length > 0
      ? chapterQueue[(currentQueueIndex + 1) % chapterQueue.length]
      : null;
  const displayName = user ? formatDisplayNickname(user.name) : "";
  const showLoginHint = bootstrapped && !user;

  const allDone = useMemo(() => {
    if (!readings.length) return false;
    return readings.every((r) => isReadingDone(r));
  }, [readings, isReadingDone]);

  const toggleDone = useCallback(
    async (r: ReadingPlanRange) => {
      if (!scopeKey) return;
      const key = todayReadingItemKey(r, prefs.planId);
      const done = !isReadingDone(r);
      if (done) {
        await markReadChapterCompleted(r.bookId, r.startChapter);
      }
      const next = await setTodayReadingItemDone(scopeKey, key, done);
      setDoneKeys(next);
      await reloadCompletedChapterKeys();
    },
    [scopeKey, isReadingDone, prefs.planId, reloadCompletedChapterKeys],
  );

  return {
    loading,
    readings: chapterRows,
    doneKeys,
    allDone,
    effectiveLocale,
    isEnglishDisplay,
    localeZhText,
    displayName,
    showLoginHint,
    neighbors,
    nextTarget,
    toggleDone,
    isReadingDone,
    planId: prefs.planId,
  };
}
