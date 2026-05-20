import { useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useLocale } from "../i18n/LocaleProvider";
import { mobileSegmentsToScreen } from "../../../../lib/telemetry/screen-map";
import {
  flushTelemetry,
  getMobileTelemetryClient,
  setTelemetryLocale,
  trackTelemetry,
} from "./client";

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const { locale } = useLocale();
  const lastScreenRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  useEffect(() => {
    const client = getMobileTelemetryClient();
    client.startPeriodicFlush();

    const onAppState = (state: AppStateStatus) => {
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

    if (AppState.currentState === "active") {
      sessionStartRef.current = Date.now();
      trackTelemetry("session_start");
    }

    const sub = AppState.addEventListener("change", onAppState);

    let netUnsub: (() => void) | undefined;
    void import("@react-native-community/netinfo").then((NetInfo) => {
      netUnsub = NetInfo.addEventListener((state) => {
        if (state.isConnected && state.isInternetReachable !== false) {
          void client.flush();
        }
      }).remove;
    }).catch(() => undefined);

    return () => {
      sub.remove();
      netUnsub?.();
      client.stopPeriodicFlush();
    };
  }, []);

  useEffect(() => {
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
      flushTelemetry();
    };
  }, []);

  return children;
}
