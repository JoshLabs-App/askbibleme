import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocale } from "../../i18n/LocaleProvider";
import { toZhTwText } from "../../i18n/site-copy";
import { completeOnboardingDevotionIntro } from "../../onboarding/onboarding-devotion-prefs";
import {
  parchmentContentPaddingHorizontal,
  parchmentWizardMaxWidth,
} from "../../read/parchmentColumnLayout";
import { useEffectiveReadingPlanPrefs } from "../../read/reading-plan/useReadingPlanStores";
import { ShellSystemBackButton } from "../../shell/ShellSystemBackButton";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../../shell/splash-branding.generated";
import { returnToExploreIndex } from "../explore-read-chapter-nav";
import {
  activateReadingPlanFromPlanner,
  isReadingPlannerChoiceActive,
  readCurrentPlannerChoice,
  readingPlannerChoiceMaxStartDay,
  readingPlannerChoiceSupportsStartDay,
  type ReadingPlannerPlanChoice,
} from "./activateReadingPlanFromPlanner";
import { getReadingPlannerDirectionCards } from "./reading-planner-data";
import { ReadingPlannerDirectionStep } from "./ReadingPlannerDirectionStep";
import { ReadingPlannerPlanStep } from "./ReadingPlannerPlanStep";

const STEP_COUNT = 2;

export type UnifiedReadingWelcomeFlowProps = {
  /** welcome = 首次欢迎页；explore = 探索 · 轻松读经入口 */
  entry: "welcome" | "explore";
  onComplete: () => void;
};

export function UnifiedReadingWelcomeFlow({ entry, onComplete }: UnifiedReadingWelcomeFlowProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const plannerPadX = parchmentContentPaddingHorizontal(windowWidth, windowHeight, 20);
  const plannerMaxWidth = parchmentWizardMaxWidth(windowWidth, windowHeight);
  const { locale } = useLocale();
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);
  const { prefs, refresh } = useEffectiveReadingPlanPrefs();

  const [step, setStep] = useState<1 | 2>(1);
  const [choice, setChoice] = useState<ReadingPlannerPlanChoice>({
    type: "triple-loop",
  });
  const [startDay, setStartDay] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  const directionCards = useMemo(() => getReadingPlannerDirectionCards(locale), [locale]);

  useEffect(() => {
    let alive = true;
    void readCurrentPlannerChoice().then((current) => {
      if (!alive) return;
      if (current) setChoice(current);
      setPrefsHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const progressText = useMemo(() => {
    if (locale === "en") return `Step ${step} of ${STEP_COUNT}`;
    return zhText(`第 ${step} 步（共 ${STEP_COUNT} 步）`);
  }, [locale, step, zhText]);

  const brandLabel =
    entry === "welcome"
      ? "AskBible.me"
      : locale === "en"
        ? "Easy reading"
        : zhText("轻松读经");

  const isActiveChoice = isReadingPlannerChoiceActive(choice, prefs);

  const handleChoiceChange = (next: ReadingPlannerPlanChoice) => {
    setChoice(next);
    const max = readingPlannerChoiceMaxStartDay(next);
    setStartDay((prev) => Math.min(Math.max(1, prev), max));
  };

  const handleStartDayChange = (next: number) => {
    const max = readingPlannerChoiceMaxStartDay(choice);
    setStartDay(Math.min(max, Math.max(1, Math.floor(next))));
  };

  const handleSkip = async () => {
    if (submitting) return;
    if (entry === "explore") {
      returnToExploreIndex(router);
      return;
    }
    setSubmitting(true);
    try {
      await completeOnboardingDevotionIntro([]);
      onComplete();
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (step === 1) {
      if (entry === "explore") router.back();
      return;
    }
    setStep(1);
  };

  const goSetPlan = () => {
    if (submitting) return;
    setStep(2);
  };

  const goPrimary = () => {
    // 探索 · 轻松读经：第 1 步主按钮为「下一页」，进入选计划。
    if (step === 1 && entry === "explore") {
      goSetPlan();
      return;
    }
    void confirmPlan();
  };

  const confirmPlan = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (entry === "welcome") {
        await completeOnboardingDevotionIntro([]);
        onComplete();
      }
      const supportsStartDay = readingPlannerChoiceSupportsStartDay(choice);
      const startDayToApply = supportsStartDay ? startDay : 1;
      // 欢迎第一页「开始」：保持隐式默认（不落盘），便于登录后拉回云端计划。
      // 第二页「设置读经计划」确认：显式写入并同步。
      if (step === 2) {
        await activateReadingPlanFromPlanner(choice, { startDay: startDayToApply });
        refresh();
      }
      if (entry === "explore") {
        const exploreStack = navigation.getParent();
        exploreStack?.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "index" }],
          }),
        );
      }
      router.replace("/read");
    } finally {
      setSubmitting(false);
    }
  };

  const primaryLabel = useMemo(() => {
    if (step === 1) {
      if (entry === "explore") {
        return locale === "en" ? "Next" : zhText("下一页");
      }
      return locale === "en" ? "Start" : zhText("开始");
    }
    const supportsStartDay = readingPlannerChoiceSupportsStartDay(choice);
    if (supportsStartDay && startDay > 1) {
      return locale === "en" ? `Start from day ${startDay}` : zhText(`从第 ${startDay} 天开始`);
    }
    if (isActiveChoice) {
      return locale === "en" ? "Start today's reading" : zhText("开始今日读经");
    }
    return locale === "en" ? "Enable this plan" : zhText("启用这个计划");
  }, [step, entry, locale, isActiveChoice, choice, startDay, zhText]);

  const setPlanLabel = locale === "en" ? "Set up reading plan" : zhText("设置读经计划");

  const skipLabel = locale === "en" ? "Skip" : zhText("略过");
  const showBack = step > 1 || entry === "explore";

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={[styles.main, plannerMaxWidth != null ? styles.mainTablet : null]}>
          <View
            style={[
              styles.topBrandWrap,
              { paddingHorizontal: plannerPadX },
              plannerMaxWidth != null ? { maxWidth: plannerMaxWidth, alignSelf: "center" } : null,
            ]}
          >
            <View style={styles.topActions}>
              {showBack ? (
                <ShellSystemBackButton onPress={goBack} disabled={submitting} />
              ) : (
                <View style={styles.topActionSide} />
              )}
              <Pressable
                onPress={() => void handleSkip()}
                hitSlop={8}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={skipLabel}
                style={({ pressed }) => [styles.skipBtn, pressed && styles.skipPressed]}
              >
                <Text style={styles.skipText}>{skipLabel}</Text>
              </Pressable>
            </View>
            <Text style={styles.brand}>{brandLabel}</Text>
            <View style={styles.brandLine} />
            <Text style={styles.progress}>{progressText}</Text>
            <View style={styles.progressDots}>
              {[1, 2].map((dot) => (
                <View key={dot} style={[styles.dot, step >= dot ? styles.dotActive : undefined]} />
              ))}
            </View>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.contentInner,
              {
                paddingHorizontal: plannerPadX,
                paddingBottom: 16,
              },
              plannerMaxWidth != null ? { maxWidth: plannerMaxWidth, alignSelf: "center", width: "100%" } : null,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          >
            {step === 1 ? <ReadingPlannerDirectionStep locale={locale} cards={directionCards} /> : null}
            {step === 2 && prefsHydrated ? (
              <ReadingPlannerPlanStep
                locale={locale}
                choice={choice}
                onChange={handleChoiceChange}
                startDay={startDay}
                onStartDayChange={handleStartDayChange}
              />
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingHorizontal: plannerPadX },
              plannerMaxWidth != null ? { maxWidth: plannerMaxWidth, alignSelf: "center", width: "100%" } : null,
            ]}
          >
            <Pressable
              onPress={goPrimary}
              disabled={submitting || (step === 2 && !prefsHydrated)}
              style={({ pressed }) => [
                styles.primaryButtonWrap,
                submitting ? styles.primaryDisabled : undefined,
                pressed ? styles.primaryPressed : undefined,
              ]}
            >
              <LinearGradient
                colors={[LOGO_YELLOW, LOGO_YELLOW]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
              </LinearGradient>
            </Pressable>
            {step === 1 && entry === "welcome" ? (
              <Pressable
                onPress={goSetPlan}
                hitSlop={8}
                disabled={submitting}
                style={({ pressed }) => [styles.setPlanWrap, pressed ? styles.skipPressed : undefined]}
                accessibilityRole="button"
                accessibilityLabel={setPlanLabel}
              >
                <Text style={styles.setPlanText}>{setPlanLabel}</Text>
              </Pressable>
            ) : null}
            {entry === "explore" && step === 2 ? (
              <Pressable
                onPress={() => returnToExploreIndex(router)}
                hitSlop={8}
                style={styles.exploreBackWrap}
                accessibilityRole="button"
              >
                <Text style={styles.exploreBackText}>
                  {locale === "en" ? "Back to Explore" : zhText("返回探索页")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  safeArea: {
    flex: 1,
  },
  main: {
    flex: 1,
  },
  mainTablet: {
    alignItems: "center",
  },
  topBrandWrap: {
    paddingTop: 6,
    width: "100%",
  },
  topActions: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topActionSide: {
    width: 44,
    minHeight: 32,
  },
  skipBtn: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 17,
    fontWeight: "400",
    color: "rgba(77, 53, 34, 0.88)",
  },
  skipPressed: {
    opacity: 0.55,
  },
  brand: {
    alignSelf: "center",
    fontSize: 18,
    fontWeight: "600",
    color: "#4d3522",
    letterSpacing: 0.4,
  },
  brandLine: {
    marginTop: 8,
    height: 1,
    width: 86,
    alignSelf: "center",
    backgroundColor: "rgba(255, 177, 1, 0.62)",
  },
  progress: {
    marginTop: 12,
    alignSelf: "center",
    fontSize: 13,
    color: "rgba(77, 53, 34, 0.76)",
  },
  progressDots: {
    marginTop: 8,
    flexDirection: "row",
    alignSelf: "center",
    gap: 8,
  },
  dot: {
    width: 24,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255, 177, 1, 0.28)",
  },
  dotActive: {
    backgroundColor: LOGO_YELLOW,
  },
  content: {
    flex: 1,
    marginTop: 8,
  },
  contentInner: {
    flexGrow: 1,
  },
  footer: {
    width: "100%",
    paddingTop: 8,
    paddingBottom: 6,
  },
  primaryButtonWrap: {
    borderRadius: 999,
    overflow: "hidden",
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: "#fffdf8",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  primaryDisabled: {
    opacity: 0.45,
  },
  primaryPressed: {
    transform: [{ scale: 0.99 }],
  },
  setPlanWrap: {
    marginTop: 14,
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  setPlanText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(77, 53, 34, 0.72)",
    textDecorationLine: "underline",
  },
  exploreBackWrap: {
    marginTop: 14,
    alignSelf: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  exploreBackText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(77, 53, 34, 0.72)",
    textDecorationLine: "underline",
  },
});
