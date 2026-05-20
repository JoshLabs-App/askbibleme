"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  flushTelemetry,
  getWebTelemetryClient,
  trackTelemetry,
} from "@/lib/telemetry/client";
import { webPathnameToScreen } from "@/lib/telemetry/screen-map";

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lastScreenRef = useRef<string | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  useEffect(() => {
    const client = getWebTelemetryClient();
    client.startPeriodicFlush();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
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

    if (document.visibilityState === "visible") {
      sessionStartRef.current = Date.now();
      trackTelemetry("session_start");
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", () => void client.flush());

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", () => void client.flush());
      client.stopPeriodicFlush();
    };
  }, []);

  useEffect(() => {
    const props = webPathnameToScreen(pathname ?? "/");
    if (!props?.screen) return;
    const key = JSON.stringify(props);
    if (lastScreenRef.current === key) return;
    lastScreenRef.current = key;
    trackTelemetry("screen_view", props);
  }, [pathname]);

  useEffect(() => {
    const onPageHide = () => flushTelemetry();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  return children;
}
