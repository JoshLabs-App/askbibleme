import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import type { ReadingPlanRange } from "./reading-plan/types";
import { useEffectiveReadingPlanPrefs, useTripleLoopProgress } from "./reading-plan/useReadingPlanStores";
import { isTripleLoopPlanId } from "./reading-plan/triple-loop-plan";
import { readOnboardingNickname } from "../onboarding/onboarding-devotion-prefs";
import {
  buildChapterQueue,
  formatDisplayNickname,
  sameChapter,
  TODAY_COMPLETE_CELEBRATION_SHOWN_KEY_PREFIX,
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
  const { progress } = useTripleLoopProgress();
  const [readings, setReadings] = useState<ReadingPlanRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());
  const [celebrateVisible, setCelebrateVisible] = useState(false);
  const [scopeKey, setScopeKey] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [hasShownCelebrateForScope, setHasShownCelebrateForScope] = useState<boolean | null>(null);

  const isTripleLoop = isTripleLoopPlanId(prefs.planId);
  const localeZhText = useCallback(
    (text: string) => (effectiveLocale === "zh-TW" ? toZhTwText(text) : text),
    [effectiveLocale],
  );

  const tripleProgressKey = isTripleLoop
    ? `${progress.ot.bookId}:${progress.ot.chapter}|${progress.nt.bookId}:${progress.nt.chapter}|${progress.wisdom.bookId}:${progress.wisdom.chapter}`
    : "";

  useEffect(() => {
    let active = true;
    const task = InteractionManager.runAfterInteractions(() => {
      void readOnboardingNickname().then((saved) => {
        if (!active) return;
        setNickname(saved);
      });
    });
    return () => {
      active = false;
      task.cancel();
    };
  }, []);

  useEffect(() => {
    if (!scopeKey) {
      setHasShownCelebrateForScope(null);
      return;
    }
    let active = true;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        try {
          const key = `${TODAY_COMPLETE_CELEBRATION_SHOWN_KEY_PREFIX}:${scopeKey}`;
          const raw = await AsyncStorage.getItem(key);
          if (!active) return;
          setHasShownCelebrateForScope(raw === "1");
        } catch {
          if (!active) return;
          setHasShownCelebrateForScope(false);
        }
      })();
    });
    return () => {
      active = false;
      task.cancel();
    };
  }, [scopeKey]);

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
            dayIndex: isTripleLoopPlanId(effective.planId)
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
  }, [prefs.planId, prefs.anchor, prefs.startedOn, prefs.dayCount, tripleProgressKey]);

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

  const chapterQueue = useMemo(() => buildChapterQueue(readings), [readings]);
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
  const displayName = formatDisplayNickname(nickname);

  const allDone = useMemo(() => {
    if (!readings.length) return false;
    return readings.every((r) => doneKeys.has(todayReadingItemKey(r)));
  }, [readings, doneKeys]);

  useEffect(() => {
    if (!allDone || !scopeKey || hasShownCelebrateForScope !== false) return;
    setCelebrateVisible(true);
    setHasShownCelebrateForScope(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void AsyncStorage.setItem(`${TODAY_COMPLETE_CELEBRATION_SHOWN_KEY_PREFIX}:${scopeKey}`, "1");
  }, [allDone, hasShownCelebrateForScope, scopeKey]);

  const toggleDone = useCallback(
    async (r: ReadingPlanRange) => {
      if (!scopeKey) return;
      const key = todayReadingItemKey(r);
      const done = !doneKeys.has(key);
      const next = await setTodayReadingItemDone(scopeKey, key, done);
      setDoneKeys(next);
    },
    [scopeKey, doneKeys],
  );

  const closeCelebrate = useCallback(() => {
    setCelebrateVisible(false);
  }, []);

  return {
    loading,
    readings,
    doneKeys,
    celebrateVisible,
    closeCelebrate,
    effectiveLocale,
    isEnglishDisplay,
    localeZhText,
    displayName,
    neighbors,
    nextTarget,
    toggleDone,
  };
}
