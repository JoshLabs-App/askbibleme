import { Platform } from "react-native";
import { WIDGET_SNAPSHOT_STORAGE_KEY } from "../notifications/notification-constants";
import { buildDailyVerseWidgetSnapshot } from "./buildDailyVerseWidgetSnapshot";
import type { DailyVerseWidgetSnapshot } from "./widget-snapshot-types";

async function writeIosWidgetSnapshot(snapshot: DailyVerseWidgetSnapshot): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const { ExtensionStorage } = await import("@bacons/apple-targets");
    const storage = new ExtensionStorage("group.me.askbible.shared");
    storage.set(WIDGET_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
    ExtensionStorage.reloadWidget();
  } catch {
    /* widget target may be absent in dev builds */
  }
}

async function writeAndroidWidgetSnapshot(snapshot: DailyVerseWidgetSnapshot): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const { NativeModules } = await import("react-native");
    const mod = NativeModules.AskBibleWidgetPrefs as
      | { setDailyVerseSnapshot?: (json: string) => void }
      | undefined;
    mod?.setDailyVerseSnapshot?.(JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export async function syncDailyVerseWidgetSnapshot(): Promise<DailyVerseWidgetSnapshot | null> {
  const snapshot = await buildDailyVerseWidgetSnapshot();
  if (!snapshot) return null;
  await Promise.all([writeIosWidgetSnapshot(snapshot), writeAndroidWidgetSnapshot(snapshot)]);
  return snapshot;
}
