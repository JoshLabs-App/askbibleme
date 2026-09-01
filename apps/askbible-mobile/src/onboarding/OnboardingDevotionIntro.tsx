import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notifications/notification-prefs-types";
import { applyLocaleWithTranslationPrefs } from "../i18n/applyLocaleWithTranslationPrefs";
import type { AppLocale } from "../i18n/config";
import { SUPPORTED_LOCALES } from "../i18n/config";
import { getLocalePickerLabel } from "../i18n/locale-display-labels";
import { useLocale } from "../i18n/LocaleProvider";
import { rescheduleAllNotifications } from "../notifications/localNotificationScheduler";
import { requestNotificationPermissions } from "../notifications/notification-permissions";
import { readNotificationPrefs, writeNotificationPrefs } from "../notifications/notification-prefs";
import { ensureAndroidReadingAlarmPermissions } from "../notifications/readingAlarmAndroidPermissions";
import {
  parchmentContentPaddingHorizontal,
  parchmentWizardMaxWidth,
} from "../read/parchmentColumnLayout";
import { ensureDefaultReadingPlanIfUnset } from "../read/reading-plan/ensure-default-reading-plan";
import { ShellSystemBackButton } from "../shell/ShellSystemBackButton";
import { authFormSurface as auth } from "../auth/authFormSurface";
import { parchmentControlSurface } from "../shell/parchmentControlSurface";
import { completeOnboardingDevotionIntro } from "./onboarding-devotion-prefs";
import { OnboardingWelcomeAlarmSection } from "./OnboardingWelcomeAlarmSection";
import { OnboardingWelcomeLoginPanel } from "./OnboardingWelcomeLoginPanel";

type OnboardingDevotionIntroProps = {
  onComplete: () => void;
  /** 非 gate 再开时可返回；首次 gate 不显示返回 */
  showBack?: boolean;
  onBack?: () => void;
};

/** 语言 + 默认读经闹钟 + 登录（根栈 /welcome 首次 gate；可手动再开） */
export function OnboardingDevotionIntro({
  onComplete,
  showBack = false,
  onBack,
}: OnboardingDevotionIntroProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const padX = parchmentContentPaddingHorizontal(windowWidth, windowHeight, 20);
  const maxWidth = parchmentWizardMaxWidth(windowWidth, windowHeight);
  const { locale, setLocale, t } = useLocale();

  const [localeSwitching, setLocaleSwitching] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(0);
  const [alarmHour, setAlarmHour] = useState(DEFAULT_NOTIFICATION_PREFS.readingReminderHour);
  const [alarmMinute, setAlarmMinute] = useState(DEFAULT_NOTIFICATION_PREFS.readingReminderMinute);

  useEffect(() => {
    void readNotificationPrefs().then((prefs) => {
      setAlarmHour(prefs.readingReminderHour);
      setAlarmMinute(prefs.readingReminderMinute);
    });
  }, []);

  const persistWelcomeDefaults = async () => {
    const current = await readNotificationPrefs();
    await writeNotificationPrefs({
      ...current,
      readingReminderEnabled: true,
      readingReminderHour: alarmHour,
      readingReminderMinute: alarmMinute,
      readingReminderMode: "scripture",
    });
    await requestNotificationPermissions();
    if (Platform.OS === "android") {
      void ensureAndroidReadingAlarmPermissions(locale);
    }
    await rescheduleAllNotifications();
    await ensureDefaultReadingPlanIfUnset();
  };

  const finishWelcome = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await persistWelcomeDefaults();
      await completeOnboardingDevotionIntro([]);
      onComplete();
    } finally {
      setFinishing(false);
    }
  };

  const handleLocalePick = (next: AppLocale) => {
    if (localeSwitching || finishing) return;
    if (next === locale) return;
    setLocale(next);
    setLocaleSwitching(true);
    void (async () => {
      try {
        await applyLocaleWithTranslationPrefs(next);
      } finally {
        setLocaleSwitching(false);
      }
    })();
  };

  const handleSkipLogin = () => {
    if (finishing) return;
    void finishWelcome();
  };

  const handleSignedIn = () => {
    void finishWelcome();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={[styles.main, maxWidth != null ? styles.mainTablet : null]}>
          <View
            style={[
              styles.topBrandWrap,
              { paddingHorizontal: padX },
              maxWidth != null ? { maxWidth, alignSelf: "center", width: "100%" } : null,
            ]}
          >
            <View style={styles.topActions}>
              {showBack ? (
                <ShellSystemBackButton onPress={() => onBack?.()} disabled={finishing} />
              ) : (
                <View style={styles.topActionSide} />
              )}
              <Pressable
                onPress={handleSkipLogin}
                hitSlop={8}
                disabled={finishing}
                accessibilityRole="button"
                accessibilityLabel={t("onboarding.welcome.loginSkip")}
                style={({ pressed }) => [styles.skipBtn, pressed && styles.skipPressed]}
              >
                <Text style={styles.skipText}>{t("onboarding.welcome.loginSkip")}</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView
            style={styles.content}
            onLayout={(event) => {
              const next = Math.round(event.nativeEvent.layout.height);
              if (next > 0 && next !== bodyHeight) setBodyHeight(next);
            }}
            contentContainerStyle={[
              styles.contentInner,
              bodyHeight > 0 ? { minHeight: bodyHeight } : null,
              { paddingHorizontal: padX },
              maxWidth != null ? { maxWidth, alignSelf: "center", width: "100%" } : null,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.plate}>
              <View style={styles.field}>
                <Text style={[auth.label, styles.fieldLabel]}>{t("onboarding.welcome.languageTitle")}</Text>
                <View style={styles.segment}>
                  {SUPPORTED_LOCALES.map((item) => {
                    const selected = locale === item;
                    return (
                      <Pressable
                        key={item}
                        onPress={() => handleLocalePick(item)}
                        disabled={localeSwitching || finishing}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={getLocalePickerLabel(item)}
                        style={({ pressed }) => [
                          styles.segmentItem,
                          selected ? styles.segmentItemActive : null,
                          pressed ? styles.skipPressed : null,
                        ]}
                      >
                        <Text style={[styles.segmentText, selected ? styles.segmentTextActive : null]}>
                          {getLocalePickerLabel(item)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <OnboardingWelcomeAlarmSection
                hour={alarmHour}
                minute={alarmMinute}
                disabled={finishing || localeSwitching}
                onChange={(nextHour, nextMinute) => {
                  setAlarmHour(nextHour);
                  setAlarmMinute(nextMinute);
                }}
              />

              <OnboardingWelcomeLoginPanel disabled={finishing || localeSwitching} onSignedIn={handleSignedIn} />
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
  content: {
    flex: 1,
    marginTop: 8,
    width: "100%",
  },
  contentInner: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 8,
  },
  plate: {
    width: "100%",
    gap: 16,
  },
  field: {
    width: "100%",
    gap: 8,
  },
  fieldLabel: {
    marginTop: 0,
  },
  segment: {
    flexDirection: "row",
    minHeight: 50,
    borderRadius: parchmentControlSurface.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: parchmentControlSurface.border,
    backgroundColor: parchmentControlSurface.fillStrong,
    overflow: "hidden",
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  segmentItemActive: {
    backgroundColor: "rgba(255, 177, 1, 0.18)",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(77, 53, 34, 0.88)",
  },
  segmentTextActive: {
    color: "#4d3522",
  },
});
