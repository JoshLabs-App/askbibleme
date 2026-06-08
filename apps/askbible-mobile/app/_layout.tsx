import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { LogBox, NativeModules, Platform, StyleSheet } from "react-native";
import { AppLogoSplash } from "../src/shell/AppLogoSplash";
import { ShellErrorBoundary } from "../src/shell/ShellErrorBoundary";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MemberAuthProvider } from "../src/auth/MemberAuthProvider";
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
import { shouldShowOnboardingDevotionIntro } from "../src/onboarding/onboarding-devotion-prefs";
import { bundledBibleTranslationsCatalog } from "../src/api/fetchBibleTranslationsCatalog";
import { preloadPrimaryScriptureTranslation } from "../src/bible/scripture-translation-download";
import { inferAppLocaleFromDevice } from "../src/i18n/config";
import { resolveDefaultPrimaryTranslationId } from "../src/read/read-bible-translation-prefs";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

if (__DEV__) {
  LogBox.ignoreAllLogs(true);
  LogBox.ignoreLogs([
    "[expo-av]: Expo AV has been deprecated",
    "Sending `onAnimatedValueUpdate` with no listeners registered",
    "An error occurred while requiring the 'ExpoClipboard' module",
  ]);
}

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
  const [navReady, setNavReady] = useState(false);
  const fontsReady = useAndroidNotoFonts();
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [bootTimedOut, setBootTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBootTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!__DEV__) return;
    const devLoading = NativeModules.DevLoadingView as { setEnabled?: (v: boolean) => void } | undefined;
    devLoading?.setEnabled?.(false);
  }, []);

  useEffect(() => {
    void clearStaleNavigationState().finally(() => setNavReady(true));
  }, []);

  useEffect(() => {
    let alive = true;
    void shouldShowOnboardingDevotionIntro()
      .then((show) => {
        if (!alive) return;
        setShowOnboarding(show);
      })
      .finally(() => {
        if (!alive) return;
        setOnboardingReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  /** 避免 AsyncStorage 等偶发挂起时永远停在橙黄启动页（TestFlight 真机） */
  useEffect(() => {
    const timer = setTimeout(() => {
      setNavReady(true);
      setOnboardingReady(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return subscribeOnboardingDevotionOpen(() => {
      setShowOnboarding(true);
      setOnboardingReady(true);
    });
  }, []);

  useEffect(() => {
    installAndroidNotoTextDefaults();
    installAndroidFontSizeGuard();
  }, []);

  const appReady = bootTimedOut || (navReady && fontsReady && onboardingReady);

  useEffect(() => {
    if (!appReady) return;
    const index = bundledBibleTranslationsCatalog();
    const primaryId = resolveDefaultPrimaryTranslationId(index, inferAppLocaleFromDevice());
    void preloadPrimaryScriptureTranslation(primaryId);
  }, [appReady]);

  return (
    <SafeAreaProvider>
      <LocaleProvider>
      <MemberAuthProvider>
      <TelemetryProvider>
      <ShellNavMenuProvider>
          {appReady ? (
            <ShellErrorBoundary>
            <MusicPlaybackProvider>
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
                <Stack.Screen name="register" options={{ headerShown: false, animation: "slide_from_right" }} />
                <Stack.Screen name="login" options={{ headerShown: false, animation: "slide_from_right" }} />
              </Stack>
              <ShellMenuButton />
              <ShellInsetClock />
              <ShellNavDrawer />
              {showOnboarding ? <OnboardingDevotionIntro onComplete={() => setShowOnboarding(false)} /> : null}
            </MusicPlaybackProvider>
            </ShellErrorBoundary>
          ) : (
            <AppLogoSplash />
          )}
      </ShellNavMenuProvider>
      </TelemetryProvider>
      </MemberAuthProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
