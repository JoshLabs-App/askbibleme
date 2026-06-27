import { Platform } from "react-native";
import { clampHomeVerseRotationSec } from "../home/homeVerseRotationPrefs";

const IOS_ROTATION_INTERVAL_SEC_KEY = "askbible-widget-rotation-interval-sec";

export async function syncWidgetRotationIntervalSec(rawSec: number): Promise<void> {
  const sec = clampHomeVerseRotationSec(rawSec);
  if (Platform.OS === "ios") {
    try {
      const { ExtensionStorage } = await import("@bacons/apple-targets");
      const storage = new ExtensionStorage("group.me.askbible.shared");
      storage.set(IOS_ROTATION_INTERVAL_SEC_KEY, sec);
      ExtensionStorage.reloadWidget();
    } catch {
      /* widget target may be absent in dev builds */
    }
    return;
  }
  if (Platform.OS === "android") {
    try {
      const { NativeModules } = await import("react-native");
      const mod = NativeModules.AskBibleWidgetPrefs as
        | { setRotationIntervalSec?: (sec: number) => void }
        | undefined;
      mod?.setRotationIntervalSec?.(sec);
    } catch {
      /* ignore */
    }
  }
}
