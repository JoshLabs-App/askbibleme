import AsyncStorage from "@react-native-async-storage/async-storage";
import { NATURE_HOME_PREFS_KEYS } from "./natureHomePrefsKeys";

const KEY = NATURE_HOME_PREFS_KEYS.liveVideo;

/** 默认开：开 App 直接播循环视频；点模糊图标才切预烘焙柔焦静帧。 */
export const DEFAULT_NATURE_LIVE_VIDEO = true;

export async function readNatureLiveVideoEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw == null) return DEFAULT_NATURE_LIVE_VIDEO;
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
    return DEFAULT_NATURE_LIVE_VIDEO;
  } catch {
    return DEFAULT_NATURE_LIVE_VIDEO;
  }
}

export async function writeNatureLiveVideoEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, enabled ? "1" : "0");
}
