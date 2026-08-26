import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, useSyncExternalStore } from "react";
import { NativeModules, Platform, StyleSheet, View } from "react-native";
import { AppLogoSplash } from "../src/shell/AppLogoSplash";
import { ShellErrorBoundary } from "../src/shell/ShellErrorBoundary";
import { SPLASH_BACKGROUND } from "../src/shell/splash-branding.generated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MemberAuthProvider } from "../src/auth/MemberAuthProvider";
import { MemberReadingSyncBridge } from "../src/member-sync/MemberReadingSyncBridge";
import { LocaleProvider } from "../src/i18n/LocaleProvider";
import { MusicPlaybackProvider } from "../src/music/MusicPlaybackContext";
import { clearStaleNavigationState } from "../src/shell/clearStaleNavigationState";
import { ShellInsetClock } from "../src/shell/ShellInsetClock";
import { ShellMenuButton } from "../src/shell/ShellMenuButton";
import { ShellNavDrawer } from "../src/shell/ShellNavDrawer";
import { AppUsageTimeBridge } from "../src/shell/AppUsageTimeBridge";
import { ShellNavMenuProvider } from "../src/shell/ShellNavMenuContext";
import { ReadBibleTypographyProvider } from "../src/read/ReadBibleTypographyContext";
import { TelemetryProvider } from "../src/telemetry/TelemetryProvider";
import { installAndroidNotoTextDefaults } from "../src/fonts/installAndroidNotoTextDefaults";
import { useAndroidNotoFonts } from "../src/fonts/useAndroidNotoFonts";
import { theme } from "../src/theme";
import {
  isOnboardingCompletedThisSession,
  subscribeOnboardingDevotionCompleted,
  subscribeOnboardingDevotionOpen,
} from "../src/onboarding/onboarding-devotion-gate";
import { NotificationSetupBridge } from "../src/notifications/NotificationSetupBridge";
import { ReadingAlarmBridge } from "../src/notifications/ReadingAlarmBridge";
import { PlanFlowPlaybackBridge } from "../src/read/PlanFlowPlaybackBridge";
import { ReadingPlanBootstrapBridge } from "../src/read/ReadingPlanBootstrapBridge";
import { WidgetReadDeepLinkBridge } from "../src/widget/WidgetReadDeepLinkBridge";
import { peekWidgetPlaybackBoot } from "../src/widget/widgetPlaybackColdStart";
import { shouldShowOnboardingDevotionIntro } from "../src/onboarding/onboarding-devotion-prefs";
import { isWelcomeRoute, welcomeRoute } from "../src/onboarding/welcome-routes";
import { useAndroidImmersiveSystemBars } from "../src/shell/useAndroidImmersiveSystemBars";
import { runQueuedReadingAlarmDevE2E } from "../src/notifications/readingAlarmDevE2ERunner";
import { logStartupTiming } from "../src/debug/startupTiming";
import { DevBuildStamp } from "../src/shell/DevBuildStamp";
import { PreviewOtaReloadBridge } from "../src/shell/PreviewOtaReloadBridge";
import {
  installIosMusicBackgroundQuarantine,
  isIosMusicBackgroundMinimal,
  subscribeIosMusicBackgroundMinimal,
} from "../src/audio/iosMusicBackgroundQuarantine";
import { ensurePrimaryNatureLakeVideoReady } from "../src/media/natureSceneReadiness";

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
  const router = useRouter();
  const pathname = usePathname();
  const [widgetPlaybackBoot] = useState(peekWidgetPlaybackBoot);
  const fontsReady = useAndroidNotoFonts();
  const [shellFeaturesReady, setShellFeaturesReady] = useState(false);
  const [onboardingBoot, setOnboardingBoot] = useState<{
    ready: boolean;
    showWelcome: boolean;
  }>({ ready: false, showWelcome: false });
  const [forceRevealBoot, setForceRevealBoot] = useState(false);
  const appReady = widgetPlaybackBoot || fontsReady;
  const onWelcomeRoute = isWelcomeRoute(pathname);
  const needsWelcomeGate =
    onboardingBoot.showWelcome && !isOnboardingCompletedThisSession();
  // 未完成引导时：等导航落到欢迎页再揭开，避免先闪主页。
  // 独立包上 replace 偶发不落地 / AsyncStorage 卡住时，超时揭开，避免一直停在启动页。
  const holdBootSplash =
    !forceRevealBoot &&
    (!appReady || !onboardingBoot.ready || (needsWelcomeGate && !onWelcomeRoute));
  const musicBgMinimal = useSyncExternalStore(
    subscribeIosMusicBackgroundMinimal,
    isIosMusicBackgroundMinimal,
    () => false,
  );
  if (__DEV__) {
    console.warn("[root-layout] render", {
      widgetPlaybackBoot,
      fontsReady,
      shellFeaturesReady,
      appReady,
      onboardingBoot,
      holdBootSplash,
    });
  }

  useEffect(() => {
    logStartupTiming("root", "mounted");
  }, []);

  useEffect(() => installIosMusicBackgroundQuarantine(), []);

  // 默认湖景 mp4：冷启动尽早从安装包解压，开 live video 时立即可播（默认仍 poster）。
  useEffect(() => {
    void ensurePrimaryNatureLakeVideoReady();
  }, []);

  // 金句语音：首次点播再整包准备，勿在闪屏后抢磁盘。
  // （文字池已是全量；语音走 ensureBundledGoldenVersePackInstalled）

  // Debug：Fast Refresh 顶部「Refreshing...」原生条；setEnabled 在新 RN 已不存在，
  // 且 hide 若被 keep-awake 异常打断会一直挂着，这里主动清掉。
  useEffect(() => {
    if (!__DEV__) return;
    const hideDevRefreshingBanner = () => {
      try {
        const mod = NativeModules.DevLoadingView as { hide?: () => void } | undefined;
        mod?.hide?.();
      } catch {
        /* ignore */
      }
    };
    hideDevRefreshingBanner();
    const t1 = setTimeout(hideDevRefreshingBanner, 400);
    const t2 = setTimeout(hideDevRefreshingBanner, 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    const task = setTimeout(() => {
      void clearStaleNavigationState();
    }, 0);
    return () => clearTimeout(task);
  }, []);

  // 启动即读引导标记，不绑 shellFeaturesReady（其 900ms 延迟只服务通知/菜单）。
  useEffect(() => {
    let alive = true;
    const timeout = setTimeout(() => {
      if (!alive) return;
      setOnboardingBoot((prev) =>
        prev.ready ? prev : { ready: true, showWelcome: false },
      );
    }, 1500);
    void shouldShowOnboardingDevotionIntro().then((show) => {
      if (!alive) return;
      clearTimeout(timeout);
      setOnboardingBoot({
        ready: true,
        showWelcome: show && !isOnboardingCompletedThisSession(),
      });
    });
    return () => {
      alive = false;
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const task = setTimeout(() => setForceRevealBoot(true), 2500);
    return () => clearTimeout(task);
  }, []);

  useEffect(() => {
    return subscribeOnboardingDevotionCompleted(() => {
      setOnboardingBoot((prev) =>
        prev.showWelcome ? { ...prev, showWelcome: false } : prev,
      );
    });
  }, []);

  useEffect(() => {
    if (!appReady || !onboardingBoot.ready || !needsWelcomeGate) return;
    if (onWelcomeRoute) return;
    router.replace(welcomeRoute({ gate: true }));
    const retry = setInterval(() => {
      router.replace(welcomeRoute({ gate: true }));
    }, 400);
    return () => clearInterval(retry);
  }, [appReady, onboardingBoot.ready, needsWelcomeGate, onWelcomeRoute, router]);

  useEffect(() => {
    return subscribeOnboardingDevotionOpen(() => {
      router.push(welcomeRoute());
    });
  }, [router]);

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
        <MusicPlaybackProvider>
          <LocaleProvider>
            <MemberAuthProvider>
              <ReadingPlanBootstrapBridge />
              <MemberReadingSyncBridge />
              <TelemetryProvider>
                <ShellNavMenuProvider>
                  <ReadBibleTypographyProvider>
                  {appReady ? (
                    musicBgMinimal ? (
                      // iOS 音乐锁屏：卸掉整棵导航/视频树，只留 Provider + 原生 AVPlayer。
                      <View style={{ flex: 1, backgroundColor: "#000" }} />
                    ) : (
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
                        <Stack.Screen
                          name="welcome"
                          options={{
                            headerShown: false,
                            animation: "fade",
                            contentStyle: { flex: 1, backgroundColor: "transparent" },
                          }}
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
                      {holdBootSplash ? (
                        <View style={styles.bootSplashOverlay} pointerEvents="auto">
                          <AppLogoSplash />
                        </View>
                      ) : null}
                      <DevBuildStamp />
                      <PreviewOtaReloadBridge />
                      <PlanFlowPlaybackBridge />
                      <WidgetReadDeepLinkBridge enabled />
                      {shellFeaturesReady ? (
                        <>
                          <NotificationSetupBridge enabled />
                          <ReadingAlarmBridge enabled />
                          <ShellMenuButton />
                          <ShellInsetClock />
                          <AppUsageTimeBridge />
                          <ShellNavDrawer />
                        </>
                      ) : null}
                    </>
                    )
                  ) : (
                    <AppLogoSplash />
                  )}
                  </ReadBibleTypographyProvider>
                </ShellNavMenuProvider>
              </TelemetryProvider>
            </MemberAuthProvider>
          </LocaleProvider>
        </MusicPlaybackProvider>
      </ShellErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootSplashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    backgroundColor: SPLASH_BACKGROUND,
  },
});
