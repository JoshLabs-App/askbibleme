import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import {
  createTelemetryClient,
  type TelemetryClient,
} from "../../../../lib/telemetry/client-core";
import type { TelemetryEventName, TelemetryPlatform } from "../../../../lib/telemetry/event-catalog";
import type { TelemetryEventProperties } from "../../../../lib/telemetry/types";

let singleton: TelemetryClient | null = null;
let netInfoModule: typeof import("@react-native-community/netinfo") | null = null;
let localeOverride: string | null = null;

export function setTelemetryLocale(locale: string | null): void {
  localeOverride = locale?.slice(0, 16) ?? null;
}

function isTelemetryDisabled(): boolean {
  return process.env.EXPO_PUBLIC_TELEMETRY_DISABLED === "1";
}

function platform(): TelemetryPlatform {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

const mobileStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
};

async function loadNetInfo() {
  if (!netInfoModule) {
    netInfoModule = await import("@react-native-community/netinfo");
  }
  return netInfoModule;
}

export function getMobileTelemetryClient(): TelemetryClient {
  if (!singleton) {
    const base = getAskBibleBaseUrl().replace(/\/$/, "");
    singleton = createTelemetryClient({
      platform: platform(),
      disabled: isTelemetryDisabled(),
      ingestUrl: `${base}/api/telemetry/ingest`,
      storage: mobileStorage,
      getAppVersion: () =>
        Constants.expoConfig?.version ??
        (typeof Constants.nativeAppVersion === "string" ? Constants.nativeAppVersion : null),
      getLocale: () => localeOverride,
      isOnline: async () => {
        try {
          const NetInfo = await loadNetInfo();
          const state = await NetInfo.fetch();
          return state.isConnected !== false && state.isInternetReachable !== false;
        } catch {
          return true;
        }
      },
    });
  }
  return singleton;
}

export function trackTelemetry(
  eventName: TelemetryEventName,
  properties?: TelemetryEventProperties,
): void {
  void getMobileTelemetryClient().track(eventName, properties);
}

export function flushTelemetry(): void {
  void getMobileTelemetryClient().flush();
}
