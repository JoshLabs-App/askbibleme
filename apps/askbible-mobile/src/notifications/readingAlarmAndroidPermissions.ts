import { Alert, Platform } from "react-native";
import type { AppLocale } from "../i18n/config";
import { resolveUiText } from "../i18n/site-copy";

type AndroidReadingAlarmModule = {
  getCapabilities?: () => Promise<{
    canScheduleExactAlarms?: boolean;
    notificationsGranted?: boolean;
    ignoringBatteryOptimizations?: boolean;
  }>;
  openExactAlarmSettings?: () => void;
  openBatteryOptimizationSettings?: () => void;
};

function getModule(): AndroidReadingAlarmModule | undefined {
  if (Platform.OS !== "android") return undefined;
  try {
    const { NativeModules } = require("react-native") as typeof import("react-native");
    return NativeModules.AskBibleReadingAlarm as AndroidReadingAlarmModule | undefined;
  } catch {
    return undefined;
  }
}

export type AndroidReadingAlarmCapabilities = {
  canScheduleExactAlarms: boolean;
  notificationsGranted: boolean;
  ignoringBatteryOptimizations: boolean;
};

export async function getAndroidReadingAlarmCapabilities(): Promise<AndroidReadingAlarmCapabilities | null> {
  const mod = getModule();
  if (!mod?.getCapabilities) return null;
  try {
    const raw = await mod.getCapabilities();
    return {
      canScheduleExactAlarms: raw?.canScheduleExactAlarms !== false,
      notificationsGranted: raw?.notificationsGranted !== false,
      ignoringBatteryOptimizations: raw?.ignoringBatteryOptimizations !== false,
    };
  } catch {
    return null;
  }
}

function promptOpenSettings(
  locale: AppLocale,
  title: string,
  message: string,
  onOpen: () => void,
): void {
  Alert.alert(title, message, [
    { text: resolveUiText(locale, "稍后", "Later"), style: "cancel" },
    {
      text: resolveUiText(locale, "前往设置", "Open Settings"),
      onPress: onOpen,
    },
  ]);
}

/**
 * Android 过夜提醒准时送达所需权限（全机型通用）：
 * 1) 精确闹钟（Android 12+，系统设置名仍为「闹钟与提醒」）
 * 2) 电池优化豁免（深度休眠后否则易被拖死）
 * 一次只提示一项，下次开启/再进设置时再补另一项。
 */
export async function ensureAndroidReadingAlarmPermissions(locale: AppLocale): Promise<void> {
  if (Platform.OS !== "android") return;
  const mod = getModule();
  if (!mod?.getCapabilities) return;

  const caps = await getAndroidReadingAlarmCapabilities();
  if (!caps) return;

  if (!caps.canScheduleExactAlarms && mod.openExactAlarmSettings) {
    promptOpenSettings(
      locale,
      resolveUiText(locale, "需要准时提醒权限", "On-time reminder permission"),
      resolveUiText(
        locale,
        "每日读经提醒需要在系统设置中允许「闹钟与提醒」，才能在设定时间准时通知你。",
        "Allow Alarms & reminders in Settings so the daily reading reminder can notify you on time.",
      ),
      () => mod.openExactAlarmSettings?.(),
    );
    return;
  }

  if (!caps.ignoringBatteryOptimizations && mod.openBatteryOptimizationSettings) {
    promptOpenSettings(
      locale,
      resolveUiText(locale, "需要关闭电池优化", "Battery optimization"),
      resolveUiText(
        locale,
        "过夜或长时间锁屏后，系统省电可能推迟提醒。请允许 AskBible.me「不受电池限制」，清晨才能准时收到通知。",
        "After overnight sleep or long lock-screen idle, battery saving may delay reminders. Allow AskBible.me to run without battery restrictions so the morning notification arrives on time.",
      ),
      () => mod.openBatteryOptimizationSettings?.(),
    );
  }
}
