import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, NativeModules, Platform } from "react-native";
import type { AppLocale } from "../i18n/config";
import { resolveUiText } from "../i18n/site-copy";

/** 只提示一次；用户选「稍后」也不会再打扰，去系统设置的入口仍在阅读提醒权限页可用。 */
const SHOWN_KEY = "askbible-android-verse-battery-prompt-shown-v1";

type AndroidCapabilitiesModule = {
  getCapabilities?: () => Promise<{ ignoringBatteryOptimizations?: boolean }>;
  openBatteryOptimizationSettings?: () => void;
};

function getModule(): AndroidCapabilitiesModule | undefined {
  if (Platform.OS !== "android") return undefined;
  try {
    // 复用阅读提醒已有的通用电池优化能力桥接，不新增原生模块。
    return NativeModules.AskBibleReadingAlarm as AndroidCapabilitiesModule | undefined;
  } catch {
    return undefined;
  }
}

/**
 * 金句连续播放锁屏后可能被系统省电打断（原生队列耗尽后要等 JS 醒来补充，
 * 深度 Doze 下可能等不到）。首次开始播放时提示用户放开电池优化，仅提示一次。
 */
export async function ensureAndroidVersePlaybackBatteryPermission(locale: AppLocale): Promise<void> {
  if (Platform.OS !== "android") return;
  const mod = getModule();
  if (!mod?.getCapabilities || !mod.openBatteryOptimizationSettings) return;
  try {
    const shown = await AsyncStorage.getItem(SHOWN_KEY);
    if (shown) return;
    const caps = await mod.getCapabilities();
    if (caps?.ignoringBatteryOptimizations !== false) return;
    await AsyncStorage.setItem(SHOWN_KEY, "1");
    Alert.alert(
      resolveUiText(locale, "锁屏后持续播放", "Keep playing after lock screen"),
      resolveUiText(
        locale,
        "长时间锁屏后，系统省电可能会打断金句连续播放。允许 AskBible.me「不受电池限制」，锁屏也能持续播放。",
        "After a long lock-screen idle, battery saving may interrupt continuous golden-verse playback. Allow AskBible.me to run without battery restrictions so playback keeps going while the screen is locked.",
      ),
      [
        { text: resolveUiText(locale, "稍后", "Later"), style: "cancel" },
        {
          text: resolveUiText(locale, "前往设置", "Open Settings"),
          onPress: () => mod.openBatteryOptimizationSettings?.(),
        },
      ],
    );
  } catch {
    /* ignore */
  }
}
