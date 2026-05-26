import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { LogBox, NativeModules, Platform, StyleSheet } from "react-native";
import { AppLogoSplash } from "../src/shell/AppLogoSplash";
import { SafeAreaProvider } from "react-native-safe-area-context";
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

  const appReady = navReady && fontsReady && onboardingReady;

  return (
    <SafeAreaProvider>
      <LocaleProvider>
      <TelemetryProvider>
      <ShellNavMenuProvider>
        <MusicPlaybackProvider>
          {appReady ? (
            <>
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
              </Stack>
              <ShellMenuButton />
              <ShellInsetClock />
              <ShellNavDrawer />
              {showOnboarding ? <OnboardingDevotionIntro onComplete={() => setShowOnboarding(false)} /> : null}
            </>
          ) : (
            <AppLogoSplash />
          )}
        </MusicPlaybackProvider>
      </ShellNavMenuProvider>
      </TelemetryProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
