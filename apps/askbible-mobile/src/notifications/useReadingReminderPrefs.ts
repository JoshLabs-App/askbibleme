import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import type { AppLocale } from "../i18n/config";
import { resolveUiText } from "../i18n/site-copy";
import type {
  NotificationPrefsV1,
  ReadingReminderMode,
} from "@/lib/notifications/notification-prefs-types";
import {
  ensureNotificationsEnabledForPrefsToggle,
  getNotificationPermissionStatus,
} from "./notification-permissions";
import {
  hydrateNotificationPrefs,
  readNotificationPrefs,
  subscribeNotificationPrefs,
  writeNotificationPrefs,
} from "./notification-prefs";
import { rescheduleAllNotifications } from "./localNotificationScheduler";
import { ensureAndroidReadingAlarmPermissions } from "./readingAlarmAndroidPermissions";

export function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function dateFromReminderTime(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function useReadingReminderPrefs(locale: AppLocale) {
  const [prefs, setPrefs] = useState<NotificationPrefsV1 | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const timePickerCommittedRef = useRef(false);
  const androidAlarmPermCheckedRef = useRef(false);

  useEffect(() => {
    void hydrateNotificationPrefs().then(setPrefs);
    return subscribeNotificationPrefs(() => {
      void readNotificationPrefs().then(setPrefs);
    });
  }, []);

  /** 已开启闹钟的用户：进页时补一次精确闹钟 / 电池优化引导（安卓通用）。 */
  useEffect(() => {
    if (Platform.OS !== "android" || !prefs?.readingReminderEnabled) return;
    if (androidAlarmPermCheckedRef.current) return;
    androidAlarmPermCheckedRef.current = true;
    void ensureAndroidReadingAlarmPermissions(locale);
  }, [prefs?.readingReminderEnabled, locale]);

  const persist = useCallback(async (next: NotificationPrefsV1) => {
    setPrefs(next);
    await writeNotificationPrefs(next);
    await rescheduleAllNotifications();
  }, []);

  const promptOpenSettings = useCallback(() => {
    Alert.alert(
      resolveUiText(locale, "需要通知权限", "Notifications permission needed"),
      resolveUiText(
        locale,
        "请在系统设置中允许 AskBible.me 发送通知，以启用每日读经提醒。",
        "Allow AskBible.me notifications in Settings to enable the daily reading reminder.",
      ),
      [
        { text: resolveUiText(locale, "取消", "Cancel"), style: "cancel" },
        {
          text: resolveUiText(locale, "前往设置", "Open Settings"),
          onPress: () => {
            void Linking.openSettings();
          },
        },
      ],
    );
  }, [locale]);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const status = await getNotificationPermissionStatus();
    if (status === "granted") return true;
    const granted = await ensureNotificationsEnabledForPrefsToggle();
    if (granted) return true;
    promptOpenSettings();
    return false;
  }, [promptOpenSettings]);

  const onToggleEnabled = useCallback(async (enabled?: boolean) => {
    if (!prefs) return;
    const enabling = enabled ?? !prefs.readingReminderEnabled;
    if (enabling === prefs.readingReminderEnabled) return;
    if (enabling) {
      const ok = await ensurePermission();
      if (!ok) return;
      if (Platform.OS === "android") {
        void ensureAndroidReadingAlarmPermissions(locale);
      }
    }
    await persist({ ...prefs, readingReminderEnabled: enabling });
  }, [prefs, ensurePermission, persist, locale]);

  const onSetMode = useCallback(
    (mode: ReadingReminderMode) => {
      if (!prefs || prefs.readingReminderMode === mode) return;
      void persist({ ...prefs, readingReminderMode: mode });
    },
    [prefs, persist],
  );

  const persistTime = useCallback(
    async (date: Date) => {
      const base = prefs ?? (await readNotificationPrefs());
      await persist({
        ...base,
        readingReminderHour: date.getHours(),
        readingReminderMinute: date.getMinutes(),
      });
    },
    [prefs, persist],
  );

  const closeTimePicker = useCallback(() => {
    setTimePickerOpen(false);
    timePickerCommittedRef.current = false;
  }, []);

  const onTimeChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === "android") {
        if (event.type === "set" && date) {
          timePickerCommittedRef.current = true;
          void persistTime(date);
          closeTimePicker();
          return;
        }
        if (event.type === "dismissed") {
          if (date && !timePickerCommittedRef.current) {
            void persistTime(date);
          }
          closeTimePicker();
        }
        return;
      }
      if (!date) return;
      if (event.type === "set" || event.type === undefined) {
        void persistTime(date);
      }
    },
    [closeTimePicker, persistTime],
  );

  const toggleTimePicker = useCallback(() => {
    setTimePickerOpen((open) => {
      timePickerCommittedRef.current = false;
      return !open;
    });
  }, []);

  return {
    prefs,
    timePickerOpen,
    toggleTimePicker,
    onTimeChange,
    onToggleEnabled,
    onSetMode,
  };
}
