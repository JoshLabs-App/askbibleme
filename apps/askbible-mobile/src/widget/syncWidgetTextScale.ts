import { Platform } from "react-native";
import type { WidgetTextScalePref } from "@/lib/widget/widget-text-scale";
import { WIDGET_TEXT_SCALE_STORAGE_KEY } from "../notifications/notification-constants";

export async function syncWidgetTextScaleToNative(scale: WidgetTextScalePref): Promise<void> {
  if (Platform.OS === "ios") {
    try {
      const { ExtensionStorage } = await import("@bacons/apple-targets");
      const storage = new ExtensionStorage("group.me.askbible.shared");
      storage.set(WIDGET_TEXT_SCALE_STORAGE_KEY, scale);
      ExtensionStorage.reloadWidget();
    } catch {
      /* widget target may be absent */
    }
    return;
  }
  if (Platform.OS === "android") {
    try {
      const { NativeModules } = await import("react-native");
      const mod = NativeModules.AskBibleWidgetPrefs as
        | { setWidgetTextScale?: (scale: string) => void }
        | undefined;
      mod?.setWidgetTextScale?.(scale);
    } catch {
      /* ignore */
    }
  }
}

export async function syncWidgetTextScaleFromPrefs(): Promise<void> {
  const { readWidgetTextScalePref } = await import("./widgetTextScalePrefs");
  await syncWidgetTextScaleToNative(await readWidgetTextScalePref());
}
