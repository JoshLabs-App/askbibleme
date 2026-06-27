import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  isWidgetTextScalePref,
  type WidgetTextScalePref,
} from "@/lib/widget/widget-text-scale";
import { WIDGET_TEXT_SCALE_STORAGE_KEY } from "../notifications/notification-constants";
import { syncWidgetTextScaleToNative } from "./syncWidgetTextScale";

export async function readWidgetTextScalePref(): Promise<WidgetTextScalePref> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_TEXT_SCALE_STORAGE_KEY);
    if (raw && isWidgetTextScalePref(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "auto";
}

export async function writeWidgetTextScalePref(scale: WidgetTextScalePref): Promise<void> {
  await AsyncStorage.setItem(WIDGET_TEXT_SCALE_STORAGE_KEY, scale);
  await syncWidgetTextScaleToNative(scale);
}
