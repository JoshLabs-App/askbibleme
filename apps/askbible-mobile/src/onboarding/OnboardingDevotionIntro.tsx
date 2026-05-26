import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocale } from "../i18n/LocaleProvider";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../shell/splash-branding.generated";
import { getCompanionNeedOptions, getSolutionCards } from "./onboarding-devotion-data";
import {
  completeOnboardingDevotionIntro,
  readOnboardingNickname,
  type CompanionNeedId,
} from "./onboarding-devotion-prefs";
import { OnboardingNeedStep } from "./OnboardingNeedStep";
import { OnboardingSolutionStep } from "./OnboardingSolutionStep";

type OnboardingDevotionIntroProps = {
  onComplete: () => void;
};

export function OnboardingDevotionIntro({ onComplete }: OnboardingDevotionIntroProps) {
  const { locale, setLocale } = useLocale();
  const [step, setStep] = useState<1 | 2>(1);
  const [nickname, setNickname] = useState("");
  const [selectedNeeds, setSelectedNeeds] = useState<CompanionNeedId[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const companionNeedOptions = useMemo(() => getCompanionNeedOptions(locale), [locale]);
  const solutionCards = useMemo(() => getSolutionCards(locale), [locale]);
  const canGoNext = selectedNeeds.length > 0;
  const canOpenSpace = nickname.trim().length > 0;
  const isLastStep = step === 2;

  const progressText = useMemo(() => {
    if (locale === "en") return step === 1 ? "Step 1 of 2" : "Step 2 of 2";
    return step === 1 ? "第 1 步（共 2 步）" : "第 2 步（共 2 步）";
  }, [locale, step]);

  const toggleNeed = (id: CompanionNeedId) => {
    setSelectedNeeds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  useEffect(() => {
    let active = true;
    void readOnboardingNickname().then((saved) => {
      if (!active) return;
      if (saved) setNickname(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  const openDevotionCompanionSpace = async () => {
    if (submitting) return;
    setSubmitting(true);
    await completeOnboardingDevotionIntro(selectedNeeds, nickname);
    onComplete();
  };

  const handlePrimaryButtonPress = () => {
    if (step === 1) {
      if (!canGoNext) return;
      setStep(2);
      return;
    }
    void openDevotionCompanionSpace();
  };

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.topBrandWrap}>
          <Text style={styles.brand}>AskBible.me</Text>
          <View style={styles.brandLine} />
          <Text style={styles.progress}>{progressText}</Text>
          <View style={styles.progressDots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={[styles.dot, step === 2 ? styles.dotActive : undefined]} />
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
          {step === 1 ? (
            <OnboardingNeedStep
              locale={locale}
              onLocaleChange={setLocale}
              selectedNeeds={selectedNeeds}
              onToggleNeed={toggleNeed}
              options={companionNeedOptions}
            />
          ) : (
            <OnboardingSolutionStep
              locale={locale}
              cards={solutionCards}
            />
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step === 2 ? (
            <View style={styles.nicknameWrap}>
              <Text style={styles.nicknameLabel}>{locale === "en" ? "Enter your nickname" : "请输入你的昵称"}</Text>
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder={locale === "en" ? "Enter your nickname" : "请输入你的昵称"}
                placeholderTextColor="rgba(77, 53, 34, 0.45)"
                style={styles.nicknameInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                maxLength={24}
              />
            </View>
          ) : null}
          <Pressable
            onPress={handlePrimaryButtonPress}
            disabled={submitting || (isLastStep ? !canOpenSpace : !canGoNext)}
            style={({ pressed }) => [
              styles.primaryButtonWrap,
              (isLastStep ? !canOpenSpace : !canGoNext) || submitting ? styles.primaryDisabled : undefined,
              pressed ? styles.primaryPressed : undefined,
            ]}
          >
            <LinearGradient
              colors={[LOGO_YELLOW, LOGO_YELLOW]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>
                {isLastStep ? (locale === "en" ? "Open my space" : "打开我的空间") : locale === "en" ? "Next" : "下一步"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
      <View style={styles.bottomDecorationLeft} />
      <View style={styles.bottomDecorationRight} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#efe1c8",
  },
  safeArea: {
    flex: 1,
  },
  topBrandWrap: {
    paddingHorizontal: 20,
    paddingTop: 6,
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
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  nicknameWrap: {
    marginBottom: 10,
    gap: 6,
  },
  nicknameLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(77, 53, 34, 0.9)",
  },
  nicknameInput: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(120, 53, 15, 0.24)",
    backgroundColor: "rgba(255, 252, 245, 0.92)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: "#2b1d15",
    fontWeight: "500",
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
  bottomDecorationLeft: {
    position: "absolute",
    left: -44,
    bottom: -36,
    width: 148,
    height: 148,
    borderRadius: 999,
    backgroundColor: "rgba(147, 111, 70, 0.09)",
  },
  bottomDecorationRight: {
    position: "absolute",
    right: -52,
    bottom: -56,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255, 177, 1, 0.1)",
  },
});
