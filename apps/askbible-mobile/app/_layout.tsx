import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { NativeModules, Platform, StyleSheet } from "react-native";
import { AppLogoSplash } from "../src/shell/AppLogoSplash";
import { ShellErrorBoundary } from "../src/shell/ShellErrorBoundary";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MemberAuthProvider } from "../src/auth/MemberAuthProvider";
import { MemberReadingSyncBridge } from "../src/member-sync/MemberReadingSyncBridge";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { MusicPlaybackProvider } from "../src/music/MusicPlaybackContext";
import { clearStaleNavigationState } from "../src/shell/clearStaleNavigationState";
import { ShellInsetClock } from "../src/shell/ShellInsetClock";
import { ShellMenuButton } from "../src/shell/ShellMenuButton";
import { ShellNavDrawer } from "../src/shell/ShellNavDrawer";
import { ShellNavMenuProvider } from "../src/shell/ShellNavMenuContext";
import { TelemetryProvider } from "../src/telemetry/TelemetryProvider";
import { installAndroidNotoTextDefaults } from "../src/fonts/installAndroidNotoTextDefaults";
import { useAndroidNotoFonts } from "../src/fonts/useAndroidNotoFonts";
import { theme } from "../src/theme";
import { OnboardingDevotionIntro } from "../src/onboarding/OnboardingDevotionIntro";
import { subscribeOnboardingDevotionOpen } from "../src/onboarding/onboarding-devotion-gate";
import { NotificationSetupBridge } from "../src/notifications/NotificationSetupBridge";
import { ReadingAlarmBridge } from "../src/notifications/ReadingAlarmBridge";
import { PlanFlowPlaybackBridge } from "../src/read/PlanFlowPlaybackBridge";
import { ReadingPlanBootstrapBridge } from "../src/read/ReadingPlanBootstrapBridge";
import { WidgetReadDeepLinkBridge } from "../src/widget/WidgetReadDeepLinkBridge";
import { peekWidgetPlaybackBoot } from "../src/widget/widgetPlaybackColdStart";
import { shouldShowOnboardingDevotionIntro } from "../src/onboarding/onboarding-devotion-prefs";
import { useAndroidImmersiveSystemBars } from "../src/shell/useAndroidImmersiveSystemBars";
import { runQueuedReadingAlarmDevE2E } from "../src/notifications/readingAlarmDevE2ERunner";
import { logStartupTiming } from "../src/debug/startupTiming";

function AndroidImmersiveSystemBars({ enabled }: { enabled: boolean }) {
  useAndroidImmersiveSystemBars(enabled);
  return null;
}

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

let androidFontSizeGuardInstalled = false;

function installAndroidFontSizeGuard() {
  if (Platform.OS !== "android" || androidFontSizeGuardInstalled) return;
  androidFontSizeGuardInstalled = true;
  StyleSheet.setStyleAttributePreprocessor?.("fontSize", (value) => {
    if (typeof value === "number" && value <= 0) return 1;
    return value;
  });
}

export default function RootLayout() {
  const [widgetPlaybackBoot] = useState(peekWidgetPlaybackBoot);
  const fontsReady = useAndroidNotoFonts();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [shellFeaturesReady, setShellFeaturesReady] = useState(false);
  const appReady = widgetPlaybackBoot || fontsReady;
  console.warn("[root-layout] render", {
    widgetPlaybackBoot,
    fontsReady,
    shellFeaturesReady,
    appReady,
  });

  useEffect(() => {
    logStartupTiming("root", "mounted");
  }, []);

  useEffect(() => {
    if (!__DEV__) return;
    const devLoading = NativeModules.DevLoadingView as { setEnabled?: (v: boolean) => void } | undefined;
    devLoading?.setEnabled?.(false);
  }, []);

  useEffect(() => {
    const task = setTimeout(() => {
      void clearStaleNavigationState();
    }, 0);
    return () => clearTimeout(task);
  }, []);

  useEffect(() => {
    let alive = true;
    void shouldShowOnboardingDevotionIntro().then((show) => {
      if (!alive) return;
      setShowOnboarding(show);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return subscribeOnboardingDevotionOpen(() => {
      setShowOnboarding(true);
    });
  }, []);

  useEffect(() => {
    installAndroidNotoTextDefaults();
    installAndroidFontSizeGuard();
  }, []);

  useEffect(() => {
    const delayMs = widgetPlaybackBoot ? 1500 : 900;
    const task = setTimeout(() => setShellFeaturesReady(true), delayMs);
    return () => clearTimeout(task);
  }, [widgetPlaybackBoot]);

  useEffect(() => {
    if (!__DEV__ || !appReady) return;
    logStartupTiming("root", "app_ready", `widget=${widgetPlaybackBoot ? "1" : "0"}`);
    const timer = setTimeout(() => {
      void runQueuedReadingAlarmDevE2E();
    }, 800);
    return () => clearTimeout(timer);
  }, [appReady]);

  return (
    <SafeAreaProvider>
      <ShellErrorBoundary>
      <LocaleProvider>
      <MemberAuthProvider>
      <ReadingPlanBootstrapBridge />
      <MemberReadingSyncBridge />
      <TelemetryProvider>
      <ShellNavMenuProvider>
          {appReady ? (
            <MusicPlaybackProvider>
            <>
            <AndroidImmersiveSystemBars enabled={appReady} />
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                contentStyle: { flex: 1, backgroundColor: theme.canvas },
              }}
            >
              <Stack.Screen
                name="(tabs)"
                options={{ headerShown: false, contentStyle: { flex: 1, backgroundColor: "transparent" } }}
              />
              <Stack.Screen name="scenes" options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen name="relax" options={{ headerShown: false }} />
              <Stack.Screen name="feedback" options={{ headerShown: false, animation: "slide_from_right" }} />
              <Stack.Screen
                name="register"
                options={{
                  headerShown: false,
                  animation: "slide_from_right",
                  contentStyle: { flex: 1, backgroundColor: "transparent" },
                }}
              />
              <Stack.Screen
                name="login"
                options={{
                  headerShown: false,
                  animation: "slide_from_right",
                  contentStyle: { flex: 1, backgroundColor: "transparent" },
                }}
              />
            </Stack>
            <PlanFlowPlaybackBridge />
            <WidgetReadDeepLinkBridge enabled />
            {shellFeaturesReady ? (
              <>
                <NotificationSetupBridge enabled />
                <ReadingAlarmBridge enabled />
                <ShellMenuButton />
                <ShellInsetClock />
                <ShellNavDrawer />
                {showOnboarding ? <OnboardingDevotionIntro onComplete={() => setShowOnboarding(false)} /> : null}
              </>
            ) : null}
            </>
            </MusicPlaybackProvider>
          ) : (
            <AppLogoSplash />
          )}
      </ShellNavMenuProvider>
      </TelemetryProvider>
      </MemberAuthProvider>
      </LocaleProvider>
      </ShellErrorBoundary>
    </SafeAreaProvider>
  );
}
