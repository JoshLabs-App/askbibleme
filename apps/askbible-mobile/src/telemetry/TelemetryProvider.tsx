import { useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert, AppState, type AppStateStatus } from "react-native";
import { useLocale } from "../i18n/LocaleProvider";
import {
  flushTelemetry,
  getMobileTelemetryClient,
  setTelemetryLocale,
  trackTelemetry,
} from "./client";
import {
  getTelemetryConsent,
  hydrateTelemetryConsent,
  isTelemetryConsentGranted,
  setTelemetryConsent,
  subscribeTelemetryConsent,
} from "./consent";

function mobileSegmentsToScreen(segments: string[]) {
  const parts = segments.filter((s) => s && !s.startsWith("(") && s !== "index");
  if (parts.length === 0) return { screen: "home" as const };

  const head = parts[0];
  if (head === "music") return { screen: "music" as const };
  if (head === "explore") return { screen: "explore" as const };
  if (head === "scenes" || head === "scenes.tsx") return { screen: "scenes" as const };
  if (head === "relax") return { screen: "relax" as const };

  if (head === "read") {
    if (parts.includes("search")) return { screen: "read.search" as const };
    if (parts.includes("plans")) return { screen: "read.plans" as const };
    if (parts.includes("favorites")) return { screen: "read.catalog" as const };
    const bookIdx = parts.findIndex((p) => /^[A-Za-z0-9_]+$/.test(p) && p !== "read");
    const chapterPart = parts[bookIdx + 1];
    if (bookIdx >= 0 && chapterPart && /^\d+$/.test(chapterPart)) {
      return {
        screen: "read.chapter" as const,
        book_id: parts[bookIdx]!.toUpperCase(),
        chapter: Number(chapterPart),
      };
    }
    return { screen: "read.catalog" as const };
  }

  if (head === "index" || head === "(tabs)") return { screen: "home" as const };
  return null;
}

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const { locale } = useLocale();
  const lastScreenRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const hasPromptedConsentRef = useRef(false);

  useEffect(() => {
    if (process.env.EXPO_PUBLIC_TELEMETRY_DISABLED === "1") return;

    let mounted = true;
    void hydrateTelemetryConsent().then((consent) => {
      if (!mounted || consent !== "unknown" || hasPromptedConsentRef.current) return;
      hasPromptedConsentRef.current = true;
      const zh = locale !== "en";
      Alert.alert(
        zh ? "匿名使用统计" : "Anonymous usage analytics",
        zh
          ? "我们仅收集匿名基础指标（打开次数、使用时长、页面访问），不用于广告追踪。是否允许？"
          : "We collect anonymous basics only (opens, session duration, and screen views), not ad tracking. Allow this?",
        [
          {
            text: zh ? "暂不允许" : "Not now",
            style: "cancel",
            onPress: () => {
              void setTelemetryConsent("denied");
            },
          },
          {
            text: zh ? "允许" : "Allow",
            onPress: () => {
              void setTelemetryConsent("granted");
            },
          },
        ],
      );
    });

    return () => {
      mounted = false;
    };
  }, [locale]);

  useEffect(() => {
    const client = getMobileTelemetryClient();
    client.startPeriodicFlush();

    const onAppState = (state: AppStateStatus) => {
      if (!isTelemetryConsentGranted()) {
        sessionStartRef.current = null;
        return;
      }
      if (state === "active") {
        sessionStartRef.current = Date.now();
        trackTelemetry("session_start");
        void client.flush();
      } else if (sessionStartRef.current != null) {
        trackTelemetry("session_end", {
          duration_ms: Date.now() - sessionStartRef.current,
        });
        sessionStartRef.current = null;
        void client.flush();
      }
    };

    if (AppState.currentState === "active" && isTelemetryConsentGranted()) {
      sessionStartRef.current = Date.now();
      trackTelemetry("session_start");
    }

    const sub = AppState.addEventListener("change", onAppState);
    const consentUnsub = subscribeTelemetryConsent(() => {
      if (!isTelemetryConsentGranted()) {
        sessionStartRef.current = null;
        return;
      }
      if (AppState.currentState === "active" && sessionStartRef.current == null) {
        sessionStartRef.current = Date.now();
        trackTelemetry("session_start");
      }
    });

    let netUnsub: (() => void) | undefined;
    void import("@react-native-community/netinfo").then((NetInfo) => {
      netUnsub = NetInfo.addEventListener((state) => {
        if (state.isConnected && state.isInternetReachable !== false) {
          void client.flush();
        }
      });
    }).catch(() => undefined);

    return () => {
      sub.remove();
      consentUnsub();
      netUnsub?.();
      client.stopPeriodicFlush();
    };
  }, []);

  useEffect(() => {
    if (!isTelemetryConsentGranted()) return;
    const props = mobileSegmentsToScreen(segments as string[]);
    if (!props?.screen) return;
    const key = JSON.stringify(props);
    if (lastScreenRef.current === key) return;
    lastScreenRef.current = key;
    trackTelemetry("screen_view", props);
  }, [segments]);

  useEffect(() => {
    setTelemetryLocale(locale);
  }, [locale]);

  useEffect(() => {
    return () => {
      if (getTelemetryConsent() === "granted") flushTelemetry();
    };
  }, []);

  return children;
}
