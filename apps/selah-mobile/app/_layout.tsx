import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { LogBox, NativeModules, View } from "react-native";
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

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

if (__DEV__) {
  LogBox.ignoreLogs([
    "[expo-av]: Expo AV has been deprecated",
    "Sending `onAnimatedValueUpdate` with no listeners registered",
    "An error occurred while requiring the 'ExpoClipboard' module",
  ]);
}

export default function RootLayout() {
  const [navReady, setNavReady] = useState(false);
  const fontsReady = useAndroidNotoFonts();

  useEffect(() => {
    if (!__DEV__) return;
    const devLoading = NativeModules.DevLoadingView as { setEnabled?: (v: boolean) => void } | undefined;
    devLoading?.setEnabled?.(false);
  }, []);

  useEffect(() => {
    void clearStaleNavigationState().finally(() => setNavReady(true));
  }, []);

  useEffect(() => {
    if (fontsReady) installAndroidNotoTextDefaults();
  }, [fontsReady]);

  const appReady = navReady && fontsReady;

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
              </Stack>
              <ShellMenuButton />
              <ShellInsetClock />
              <ShellNavDrawer />
            </>
          ) : (
            <View style={{ flex: 1, backgroundColor: theme.canvas }} />
          )}
        </MusicPlaybackProvider>
      </ShellNavMenuProvider>
      </TelemetryProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
