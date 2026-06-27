import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "../../i18n/LocaleProvider";
import { toZhTwText } from "../../i18n/site-copy";
import { NT_DEEP_REPEAT_DEFAULT_PACE } from "../../read/reading-plan/nt-deep-repeat-pace";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../../shell/splash-branding.generated";
import { trackTap } from "../../telemetry/tap";
import {
  activateReadingPlanFromPlanner,
  isReadingPlannerChoiceActive,
  readCurrentPlannerChoice,
  type ReadingPlannerPlanChoice,
} from "./activateReadingPlanFromPlanner";
import {
  getReadingPlannerDirectionCards,
  getReadingPlannerPainOptions,
  type ReadingPlannerPainId,
} from "./reading-planner-data";
import { ReadingPlannerDirectionStep } from "./ReadingPlannerDirectionStep";
import { ReadingPlannerPainStep } from "./ReadingPlannerPainStep";
import { ReadingPlannerPlanStep } from "./ReadingPlannerPlanStep";
import { useEffectiveReadingPlanPrefs } from "../../read/reading-plan/useReadingPlanStores";
import { returnToExploreIndex } from "../explore-read-chapter-nav";
import {
  parchmentContentPaddingHorizontal,
  parchmentWizardMaxWidth,
} from "../../read/parchmentColumnLayout";

const STEP_COUNT = 3;

export function ReadingPlannerScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const plannerPadX = parchmentContentPaddingHorizontal(windowWidth, windowHeight, 20);
  const plannerMaxWidth = parchmentWizardMaxWidth(windowWidth, windowHeight);
  const { locale } = useLocale();
  const zhText = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);
  const { prefs, refresh } = useEffectiveReadingPlanPrefs();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPains, setSelectedPains] = useState<ReadingPlannerPainId[]>([]);
  const [choice, setChoice] = useState<ReadingPlannerPlanChoice>({
    type: "nt-deep-repeat",
    pace: NT_DEEP_REPEAT_DEFAULT_PACE,
  });
  const [submitting, setSubmitting] = useState(false);
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  const painOptions = useMemo(() => getReadingPlannerPainOptions(locale), [locale]);
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

  const isActiveChoice = isReadingPlannerChoiceActive(choice, prefs);

  const togglePain = (id: ReadingPlannerPainId) => {
    setSelectedPains((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const goBack = () => {
    if (step === 1) {
      router.back();
      return;
    }
    setStep((prev) => (prev === 3 ? 2 : 1));
  };

  const goNext = () => {
    if (step < 3) {
      setStep((prev) => (prev === 1 ? 2 : 3));
      return;
    }
    void confirmPlan();
  };

  const confirmPlan = async () => {
    if (submitting) return;
    setSubmitting(true);
    trackTap("reading-planner.confirm");
    try {
      if (!isActiveChoice) {
        await activateReadingPlanFromPlanner(choice);
        refresh();
      }
      const exploreStack = navigation.getParent();
      exploreStack?.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "index" }],
        }),
      );
      router.replace("/read");
    } finally {
      setSubmitting(false);
    }
  };

  const primaryLabel = useMemo(() => {
    if (step < 3) {
      return locale === "en" ? "Next" : zhText("下一步");
    }
    if (isActiveChoice) {
      return locale === "en" ? "Start today's reading" : zhText("开始今日读经");
    }
    return locale === "en" ? "Enable this plan" : zhText("启用这个计划");
  }, [step, locale, isActiveChoice, zhText]);

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
              <Pressable onPress={goBack} hitSlop={8}>
                <Text style={styles.backText}>
                  {step === 1
                    ? locale === "en"
                      ? "Explore"
                      : zhText("探索")
                    : locale === "en"
                      ? "Back"
                      : zhText("上一步")}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.brand}>{locale === "en" ? "Easy Reading" : zhText("轻松读经")}</Text>
            <View style={styles.brandLine} />
            <Text style={styles.progress}>{progressText}</Text>
            <View style={styles.progressDots}>
              {[1, 2, 3].map((dot) => (
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
                paddingBottom: Math.max(insets.bottom, 20) + 12,
              },
              plannerMaxWidth != null ? { maxWidth: plannerMaxWidth, alignSelf: "center", width: "100%" } : null,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          >
            {step === 1 ? (
              <ReadingPlannerPainStep
                locale={locale}
                options={painOptions}
                selected={selectedPains}
                onToggle={togglePain}
              />
            ) : null}
            {step === 2 ? <ReadingPlannerDirectionStep locale={locale} cards={directionCards} /> : null}
            {step === 3 && prefsHydrated ? (
              <ReadingPlannerPlanStep locale={locale} choice={choice} onChange={setChoice} />
            ) : null}

            <View style={styles.footer}>
              <Pressable
                onPress={goNext}
                disabled={submitting || (step === 3 && !prefsHydrated)}
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
              {step === 3 ? (
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
          </ScrollView>
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
    minHeight: 24,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(77, 53, 34, 0.76)",
    paddingHorizontal: 4,
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
    marginTop: 8,
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
