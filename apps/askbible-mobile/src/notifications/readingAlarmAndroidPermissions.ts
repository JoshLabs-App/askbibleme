import { Alert, Platform } from "react-native";
import type { AppLocale } from "../i18n/config";
import { resolveUiText } from "../i18n/site-copy";

type AndroidReadingAlarmModule = {
  getCapabilities?: () => Promise<{
    canScheduleExactAlarms?: boolean;
    canUseFullScreenIntent?: boolean;
    notificationsGranted?: boolean;
  }>;
  openExactAlarmSettings?: () => void;
  openFullScreenIntentSettings?: () => void;
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
  canUseFullScreenIntent: boolean;
  notificationsGranted: boolean;
};

export async function getAndroidReadingAlarmCapabilities(): Promise<AndroidReadingAlarmCapabilities | null> {
  const mod = getModule();
  if (!mod?.getCapabilities) return null;
  try {
    const raw = await mod.getCapabilities();
    return {
      canScheduleExactAlarms: raw?.canScheduleExactAlarms !== false,
      canUseFullScreenIntent: raw?.canUseFullScreenIntent !== false,
      notificationsGranted: raw?.notificationsGranted !== false,
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

/** Prompt for exact-alarm and full-screen intent permissions required on Samsung / Android 12+. */
export async function ensureAndroidReadingAlarmPermissions(locale: AppLocale): Promise<void> {
  if (Platform.OS !== "android") return;
  const mod = getModule();
  if (!mod?.getCapabilities) return;

  const caps = await getAndroidReadingAlarmCapabilities();
  if (!caps) return;

  if (!caps.canScheduleExactAlarms && mod.openExactAlarmSettings) {
    promptOpenSettings(
      locale,
      resolveUiText(locale, "需要精确闹钟权限", "Exact alarm permission needed"),
      resolveUiText(
        locale,
        "每日清晨闹钟需要在系统设置中允许「闹钟与提醒」，才能在设定时间自动打开。",
        "Allow Alarms & reminders in Settings so the daily morning alarm can open automatically at the scheduled time.",
      ),
      () => mod.openExactAlarmSettings?.(),
    );
    return;
  }

  if (!caps.canUseFullScreenIntent && mod.openFullScreenIntentSettings) {
    promptOpenSettings(
      locale,
      resolveUiText(locale, "需要全屏通知权限", "Full-screen notification needed"),
      resolveUiText(
        locale,
        "请在系统设置中允许 AskBible.me 使用全屏通知，锁屏时闹钟才能自动弹出。",
        "Allow full-screen notifications for AskBible.me so the alarm can appear over the lock screen.",
      ),
      () => mod.openFullScreenIntentSettings?.(),
    );
  }
}
