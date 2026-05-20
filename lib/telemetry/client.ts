"use client";

import { createTelemetryClient, type TelemetryClient } from "@/lib/telemetry/client-core";
import type { TelemetryEventName } from "@/lib/telemetry/event-catalog";
import type { TelemetryEventProperties } from "@/lib/telemetry/types";

let singleton: TelemetryClient | null = null;

function isTelemetryDisabled(): boolean {
  return process.env.NEXT_PUBLIC_TELEMETRY_DISABLED === "1";
}

const webStorage = {
  async getItem(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    localStorage.setItem(key, value);
  },
};

export function getWebTelemetryClient(): TelemetryClient {
  if (!singleton) {
    singleton = createTelemetryClient({
      platform: "web",
      disabled: isTelemetryDisabled(),
      ingestUrl: "/api/telemetry/ingest",
      storage: webStorage,
      getAppVersion: () => {
        try {
          return document.querySelector('meta[name="app-build"]')?.getAttribute("content") ?? null;
        } catch {
          return null;
        }
      },
      getLocale: () => {
        try {
          return document.documentElement.lang?.slice(0, 16) || null;
        } catch {
          return null;
        }
      },
      isOnline: () => (typeof navigator !== "undefined" ? navigator.onLine : true),
    });
  }
  return singleton;
}

export function trackTelemetry(
  eventName: TelemetryEventName,
  properties?: TelemetryEventProperties,
): void {
  void getWebTelemetryClient().track(eventName, properties);
}

export function flushTelemetry(): void {
  void getWebTelemetryClient().flush();
}
