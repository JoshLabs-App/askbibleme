import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocale } from "../i18n/LocaleProvider";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../shell/splash-branding.generated";
import { resolveReadChapterNeighbors } from "../bible/read-chapter-neighbors";
import { formatReadingPlanRange } from "./reading-plan/format-reading-range";
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

type Props = {
  bookId: string;
  chapter: number;
};

type ChapterRef = {
  bookId: string;
  chapter: number;
};

const TODAY_COMPLETE_CELEBRATION_SHOWN_KEY_PREFIX = "askbible-today-complete-celebration-shown-v1";

function buildChapterQueue(readings: ReadingPlanRange[]): ChapterRef[] {
  const out: ChapterRef[] = [];
  for (const r of readings) {
    for (let ch = r.startChapter; ch <= r.endChapter; ch += 1) {
      out.push({ bookId: r.bookId, chapter: ch });
    }
  }
  return out;
}

function sameChapter(a: ChapterRef, b: ChapterRef): boolean {
  return a.bookId === b.bookId && a.chapter === b.chapter;
}

function formatDisplayNickname(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function ReadChapterCompletionPlanPanel({ bookId, chapter }: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const { prefs } = useEffectiveReadingPlanPrefs();
  const { progress } = useTripleLoopProgress();
  const [readings, setReadings] = useState<ReadingPlanRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());
  const [celebrateVisible, setCelebrateVisible] = useState(false);
  const [scopeKey, setScopeKey] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [hasShownCelebrateForScope, setHasShownCelebrateForScope] = useState<boolean | null>(null);
  const celebrationSoundRef = useRef<Audio.Sound | null>(null);
  const celebrateScale = useRef(new Animated.Value(0.9)).current;
  const celebrateOpacity = useRef(new Animated.Value(0)).current;
  const sparklePulse = useRef(new Animated.Value(0)).current;
  const celebrateCtaPulse = useRef(new Animated.Value(0)).current;
  const sparkleLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const isTripleLoop = isTripleLoopPlanId(prefs.planId);

  const tripleProgressKey = isTripleLoop
    ? `${progress.ot.bookId}:${progress.ot.chapter}|${progress.nt.bookId}:${progress.nt.chapter}|${progress.wisdom.bookId}:${progress.wisdom.chapter}`
    : "";

  useEffect(() => {
    let active = true;
    void readOnboardingNickname().then((saved) => {
      if (!active) return;
      setNickname(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!scopeKey) {
      setHasShownCelebrateForScope(null);
      return;
    }
    let active = true;
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
    return () => {
      active = false;
    };
  }, [scopeKey]);

  const stopSparkleLoop = useCallback(() => {
    sparkleLoopRef.current?.stop();
    sparkleLoopRef.current = null;
  }, []);

  const startCelebrateAnimation = useCallback(() => {
    stopSparkleLoop();
    celebrateScale.setValue(0.9);
    celebrateOpacity.setValue(0);
    sparklePulse.setValue(0);
    celebrateCtaPulse.setValue(0);
    Animated.parallel([
      Animated.timing(celebrateOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(celebrateScale, {
        toValue: 1,
        damping: 14,
        stiffness: 180,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparklePulse, {
          toValue: 1,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sparklePulse, {
          toValue: 0,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    sparkleLoopRef.current = loop;
    loop.start();

    Animated.sequence([
      Animated.delay(260),
      Animated.timing(celebrateCtaPulse, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(celebrateCtaPulse, {
        toValue: 0,
        duration: 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [celebrateOpacity, celebrateScale, sparklePulse, stopSparkleLoop]);

  const playCelebrateSound = useCallback(async () => {
    try {
      if (!celebrationSoundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/audio/today-plan-complete.mp3"),
          { shouldPlay: false, volume: 1 },
        );
        celebrationSoundRef.current = sound;
      }
      await celebrationSoundRef.current.replayAsync();
    } catch {
      /* ignore audio playback errors */
    }
  }, []);

  const closeCelebrate = useCallback(() => {
    stopSparkleLoop();
    setCelebrateVisible(false);
  }, [stopSparkleLoop]);

  useEffect(() => {
    return () => {
      stopSparkleLoop();
      const sound = celebrationSoundRef.current;
      if (sound) {
        celebrationSoundRef.current = null;
        void sound.unloadAsync();
      }
    };
  }, [stopSparkleLoop]);

  useEffect(() => {
    let cancelled = false;
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
    return () => {
      cancelled = true;
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
    void reloadDoneKeys();
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
    startCelebrateAnimation();
    void playCelebrateSound();
    void AsyncStorage.setItem(`${TODAY_COMPLETE_CELEBRATION_SHOWN_KEY_PREFIX}:${scopeKey}`, "1");
  }, [allDone, hasShownCelebrateForScope, playCelebrateSound, scopeKey, startCelebrateAnimation]);

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

  if (loading || !readings.length) return null;

  return (
    <>
      <View style={styles.card}>
        <View style={styles.titleWrap}>
          <Text style={styles.titleName}>{displayName || (locale === "en" ? "Friend" : "你")}</Text>
          <Text style={styles.titleMain}>
            {locale === "en" ? "🎉 Great job! This chapter is complete." : "🎉 真棒！本章已完成"}
          </Text>
        </View>

        <View style={styles.readingList}>
          {readings.map((r) => {
            const key = todayReadingItemKey(r);
            const done = doneKeys.has(key);
            const label = formatReadingPlanRange(r);
            return (
              <View key={key} style={styles.readingRow}>
                <Pressable
                  onPress={() => void toggleDone(r)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.checkboxBtn, pressed && styles.pressed]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                >
                  <MaterialIcons
                    name={done ? "check-box" : "check-box-outline-blank"}
                    size={18}
                    color={done ? c.ink : c.muted}
                  />
                </Pressable>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/read/[bookId]/[chapter]",
                      params: { bookId: r.bookId, chapter: String(r.startChapter), planFlow: "1" },
                    })
                  }
                  hitSlop={8}
                  style={({ pressed }) => [styles.readingOpenBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={locale === "en" ? `Open ${label}` : `打开 ${label}`}
                >
                  <View style={styles.readingOpenInner}>
                    <Text style={[styles.readingText, done && styles.readingTextDone]}>{label}</Text>
                    <MaterialIcons name="chevron-right" size={18} color={done ? "#8A7762" : "#6A543B"} />
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={styles.actionsWrap}>
          <View style={styles.actions}>
          {nextTarget ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/read/[bookId]/[chapter]",
                  params: { bookId: nextTarget.bookId, chapter: String(nextTarget.chapter), planFlow: "1" },
                })
              }
              hitSlop={8}
              style={({ pressed }) => [styles.actionBtn, styles.actionPrimary, pressed && styles.pressed]}
            >
              <Text style={[styles.actionText, styles.actionPrimaryText]}>
                {locale === "en" ? "Continue Plan..." : "继续计划……"}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push("/read")}
              hitSlop={8}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            >
              <Text style={styles.actionText}>{locale === "en" ? "Back to Read Home" : "回到读经首页"}</Text>
            </Pressable>
          )}
          </View>
        </View>
      </View>

      <View style={styles.bottomNavRow}>
        <Pressable
          onPress={
            neighbors.prev
              ? () =>
                  router.push({
                    pathname: "/read/[bookId]/[chapter]",
                    params: {
                      bookId: neighbors.prev.bookId,
                      chapter: String(neighbors.prev.chapter),
                    },
                  })
              : undefined
          }
          hitSlop={10}
          disabled={!neighbors.prev}
          style={({ pressed }) => [
            styles.chapterSideNavBtn,
            !neighbors.prev && styles.chapterSideNavBtnDisabled,
            pressed && neighbors.prev && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={locale === "en" ? "Previous chapter" : "上一章"}
        >
          <Text style={styles.chapterSideNavText}>{"<"}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/read")}
          hitSlop={8}
          style={({ pressed }) => [styles.backHomeLinkWrap, pressed && styles.pressed]}
        >
          <Text style={styles.backHomeLinkText}>{locale === "en" ? "Back Home" : "返回主页"}</Text>
        </Pressable>

        <Pressable
          onPress={
            neighbors.next
              ? () =>
                  router.push({
                    pathname: "/read/[bookId]/[chapter]",
                    params: {
                      bookId: neighbors.next.bookId,
                      chapter: String(neighbors.next.chapter),
                    },
                  })
              : undefined
          }
          hitSlop={10}
          disabled={!neighbors.next}
          style={({ pressed }) => [
            styles.chapterSideNavBtn,
            !neighbors.next && styles.chapterSideNavBtnDisabled,
            pressed && neighbors.next && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={locale === "en" ? "Next chapter" : "下一章"}
        >
          <Text style={styles.chapterSideNavText}>{">"}</Text>
        </Pressable>
      </View>

      <Modal visible={celebrateVisible} animationType="fade" transparent onRequestClose={closeCelebrate}>
        <View style={styles.celebrateMask}>
          <Animated.View
            style={[
              styles.celebrateCard,
              {
                opacity: celebrateOpacity,
                transform: [{ scale: celebrateScale }],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.sparkleRow,
                {
                  opacity: sparklePulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                  transform: [
                    {
                      translateY: sparklePulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [2, -2],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.sparkle}>✨</Text>
              <Text style={styles.sparkle}>🎉</Text>
              <Text style={styles.sparkle}>✨</Text>
            </Animated.View>
            <Text style={styles.celebrateEmoji}>🎉</Text>
            <Text style={styles.celebrateTitle}>{locale === "en" ? "Great Job!" : "恭喜你，今天完成了！"}</Text>
            <Text style={styles.celebrateBody}>
              {locale === "en"
                ? "You completed all today's readings. Keep this quiet rhythm tomorrow."
                : "你已完成今天所有读经计划。愿你把这份安静带进下一天。"}
            </Text>
            <View style={styles.celebrateActions}>
              <Pressable
                onPress={closeCelebrate}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              >
                <Text style={styles.actionText}>{locale === "en" ? "Keep Reading" : "继续阅读"}</Text>
              </Pressable>
              <Animated.View
                style={[
                  styles.celebrateCtaWrap,
                  {
                    transform: [
                      {
                        scale: celebrateCtaPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.04],
                        }),
                      },
                    ],
                    shadowOpacity: celebrateCtaPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.12, 0.28],
                    }),
                  },
                ]}
              >
                <Pressable
                  onPress={() => {
                    closeCelebrate();
                    router.push("/read");
                  }}
                  style={({ pressed }) => [styles.actionBtn, styles.actionPrimary, pressed && styles.pressed]}
                >
                  <Text style={[styles.actionText, styles.actionPrimaryText]}>
                    {locale === "en" ? "Back to Home" : "回到读经首页"}
                  </Text>
                </Pressable>
              </Animated.View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 50,
    borderWidth: 1,
    borderColor: "rgba(113, 84, 53, 0.34)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "rgba(249, 240, 222, 0.95)",
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    shadowColor: "#3A2718",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  titleWrap: {
    alignItems: "center",
  },
  titleName: {
    fontSize: 34,
    lineHeight: 40,
    ...parchmentSans(700),
    letterSpacing: 0.1,
    color: "#2A170A",
    textAlign: "center",
  },
  titleMain: {
    marginTop: 2,
    fontSize: 24,
    lineHeight: 30,
    ...parchmentSans(700),
    letterSpacing: 0,
    color: "#2A170A",
    textAlign: "center",
  },
  readingList: {
    marginTop: 10,
    gap: 8,
  },
  readingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 42,
    paddingVertical: 2,
  },
  checkboxBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  readingOpenBtn: {
    flex: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingVertical: 4,
  },
  readingOpenInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  readingText: {
    fontSize: 18,
    color: "#2F2014",
    ...parchmentSans(500),
    lineHeight: 24,
  },
  readingTextDone: {
    textDecorationLine: "line-through",
    color: "#6A5B49",
  },
  actionsWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(113, 84, 53, 0.25)",
  },
  actions: {
    gap: 8,
  },
  actionBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(116, 87, 57, 0.28)",
    backgroundColor: "rgba(255, 251, 242, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 13,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPrimary: {
    backgroundColor: LOGO_YELLOW,
    borderColor: "rgba(181, 124, 0, 0.9)",
  },
  actionText: {
    fontSize: 18,
    ...parchmentSans(600),
    color: "#2C1E12",
  },
  actionPrimaryText: {
    color: "#2C1B0F",
  },
  backHomeLinkWrap: {
    marginTop: 50,
    marginBottom: 30,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backHomeLinkText: {
    fontSize: 17,
    ...parchmentSans(500),
    color: "#6A543B",
  },
  bottomNavRow: {
    marginTop: 4,
    marginBottom: 2,
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chapterSideNavBtn: {
    marginTop: 50,
    marginBottom: 30,
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  chapterSideNavBtnDisabled: {
    opacity: 0.2,
  },
  chapterSideNavText: {
    fontSize: 26,
    lineHeight: 28,
    ...parchmentSans(500),
    color: "#6A543B",
  },
  celebrateMask: {
    flex: 1,
    backgroundColor: "rgba(15, 11, 8, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  celebrateCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: "rgba(255, 252, 245, 0.98)",
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  celebrateEmoji: { fontSize: 34 },
  sparkleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 6,
  },
  sparkle: {
    fontSize: 16,
  },
  celebrateTitle: {
    marginTop: 8,
    fontSize: 22,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
  },
  celebrateBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: c.muted,
    textAlign: "center",
  },
  celebrateActions: {
    marginTop: 14,
    width: "100%",
    gap: 8,
  },
  celebrateCtaWrap: {
    borderRadius: 14,
    shadowColor: "#b17200",
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  pressed: { opacity: 0.88 },
});
