import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform, Pressable, Text, View } from "react-native";
import type { AppLocale } from "../i18n/config";
import { resolveUiText } from "../i18n/site-copy";
import type {
  NotificationPrefsV1,
  ReadingReminderMode,
  ReadingReminderWeekday,
} from "@/lib/notifications/notification-prefs-types";
import { READING_REMINDER_WEEKDAYS_ALL } from "@/lib/notifications/notification-prefs-types";
import {
  ensureNotificationsEnabledForPrefsToggle,
  getNotificationPermissionStatus,
} from "../notifications/notification-permissions";
import {
  hydrateNotificationPrefs,
  readNotificationPrefs,
  subscribeNotificationPrefs,
  writeNotificationPrefs,
} from "../notifications/notification-prefs";
import { rescheduleAllNotifications } from "../notifications/localNotificationScheduler";
import { ensureAndroidReadingAlarmPermissions } from "../notifications/readingAlarmAndroidPermissions";
import { shellNavDrawerStyles as styles } from "./shellNavDrawerStyles";

type Props = {
  locale: AppLocale;
};

type TimeField = "readingReminder" | "dailyVerse";

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function dateFromTime(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

const WEEKDAY_LABELS: Record<AppLocale, Record<ReadingReminderWeekday, string>> = {
  "zh-CN": { 1: "日", 2: "一", 3: "二", 4: "三", 5: "四", 6: "五", 7: "六" },
  "zh-TW": { 1: "日", 2: "一", 3: "二", 4: "三", 5: "四", 6: "五", 7: "六" },
  en: { 1: "S", 2: "M", 3: "T", 4: "W", 5: "T", 6: "F", 7: "S" },
};

type InlineTimePickerProps = {
  visible: boolean;
  hour: number;
  minute: number;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
};

function InlineNotificationTimePicker({ visible, hour, minute, onChange }: InlineTimePickerProps) {
  if (!visible) return null;
  return (
    <View style={styles.timePickerWrap}>
      <DateTimePicker
        value={dateFromTime(hour, minute)}
        mode="time"
        is24Hour
        display={Platform.OS === "ios" ? "spinner" : "default"}
        themeVariant="light"
        onChange={onChange}
      />
    </View>
  );
}

export function ShellNavDrawerNotificationsSection({ locale }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefsV1 | null>(null);
  const [timePickerField, setTimePickerField] = useState<TimeField | null>(null);
  /** Android：部分机型 set 后还会再发 dismissed（带旧时间），避免覆盖刚保存的值。 */
  const timePickerCommittedRef = useRef(false);

  useEffect(() => {
    void hydrateNotificationPrefs().then(setPrefs);
    return subscribeNotificationPrefs(() => {
      void readNotificationPrefs().then(setPrefs);
    });
  }, []);

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
        "请在系统设置中允许 AskBible.me 发送通知，以启用每日清晨闹钟与每日金句。",
        "Allow AskBible.me notifications in Settings to enable the daily morning alarm and daily verses.",
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

  const onToggleReading = useCallback(async () => {
    if (!prefs) return;
    const enabling = !prefs.readingReminderEnabled;
    if (enabling) {
      const ok = await ensurePermission();
      if (!ok) return;
      if (Platform.OS === "android") {
        void ensureAndroidReadingAlarmPermissions(locale);
      }
    }
    await persist({ ...prefs, readingReminderEnabled: enabling });
  }, [prefs, ensurePermission, persist, locale]);

  const onToggleDailyVerse = useCallback(async () => {
    if (!prefs) return;
    const enabling = !prefs.dailyVerseEnabled;
    if (enabling) {
      const ok = await ensurePermission();
      if (!ok) return;
    }
    await persist({ ...prefs, dailyVerseEnabled: enabling });
  }, [prefs, ensurePermission, persist]);

  const onSetReadingReminderMode = useCallback(
    (mode: ReadingReminderMode) => {
      if (!prefs || prefs.readingReminderMode === mode) return;
      void persist({ ...prefs, readingReminderMode: mode });
    },
    [prefs, persist],
  );

  const onToggleWeekday = useCallback(
    (weekday: ReadingReminderWeekday) => {
      if (!prefs) return;
      const selected = new Set(prefs.readingReminderWeekdays);
      if (selected.has(weekday)) {
        if (selected.size <= 1) return;
        selected.delete(weekday);
      } else {
        selected.add(weekday);
      }
      const nextWeekdays = [...selected].sort((a, b) => a - b) as ReadingReminderWeekday[];
      void persist({ ...prefs, readingReminderWeekdays: nextWeekdays });
    },
    [prefs, persist],
  );

  const persistTimeSelection = useCallback(
    async (field: TimeField, date: Date) => {
      const base = prefs ?? (await readNotificationPrefs());
      const hour = date.getHours();
      const minute = date.getMinutes();
      const next =
        field === "readingReminder"
          ? { ...base, readingReminderHour: hour, readingReminderMinute: minute }
          : { ...base, dailyVerseHour: hour, dailyVerseMinute: minute };
      await persist(next);
    },
    [prefs, persist],
  );

  const closeTimePicker = useCallback(() => {
    setTimePickerField(null);
    timePickerCommittedRef.current = false;
  }, []);

  const onTimeChange = useCallback(
    (field: TimeField, event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === "android") {
        if (event.type === "set" && date) {
          timePickerCommittedRef.current = true;
          void persistTimeSelection(field, date);
          closeTimePicker();
          return;
        }
        if (event.type === "dismissed") {
          // 少数机型只发 dismissed（点确定）；若已 set 过则忽略，防止旧时间覆盖。
          if (date && !timePickerCommittedRef.current) {
            void persistTimeSelection(field, date);
          }
          closeTimePicker();
          return;
        }
        return;
      }

      if (!date) return;
      if (event.type === "set" || event.type === undefined) {
        void persistTimeSelection(field, date);
      }
    },
    [closeTimePicker, persistTimeSelection],
  );

  const toggleTimePicker = useCallback((field: TimeField) => {
    setTimePickerField((current) => {
      if (current === field) {
        timePickerCommittedRef.current = false;
        return null;
      }
      timePickerCommittedRef.current = false;
      return field;
    });
  }, []);

  if (!prefs) return null;

  return (
    <>
      <Text style={styles.sectionLabelCompact}>
        {resolveUiText(locale, "提醒与金句", "Reminders & verse")}
      </Text>

      <Pressable
        style={({ pressed }) => [styles.ttsMasterRow, pressed ? styles.ttsMasterRowPressed : null]}
        onPress={() => {
          void onToggleReading();
        }}
      >
        <Text style={styles.ttsMasterLabel}>
          {resolveUiText(locale, "每日清晨闹钟", "Daily morning alarm")}
        </Text>
        <Text style={styles.ttsMasterDetail}>
          {prefs.readingReminderEnabled
            ? resolveUiText(locale, "已开启", "On")
            : resolveUiText(locale, "已关闭", "Off")}
        </Text>
      </Pressable>

      {prefs.readingReminderEnabled ? (
        <View style={styles.ttsControlsWrap}>
          <Pressable
            style={({ pressed }) => [styles.ttsMasterRow, pressed ? styles.ttsMasterRowPressed : null]}
            onPress={() => toggleTimePicker("readingReminder")}
          >
            <Text style={styles.ttsSliderLabel}>{resolveUiText(locale, "提醒时间", "Time")}</Text>
            <Text style={styles.ttsSliderValue}>
              {formatTime(prefs.readingReminderHour, prefs.readingReminderMinute)}
            </Text>
          </Pressable>
          <InlineNotificationTimePicker
            visible={timePickerField === "readingReminder"}
            hour={prefs.readingReminderHour}
            minute={prefs.readingReminderMinute}
            onChange={(event, date) => onTimeChange("readingReminder", event, date)}
          />
          <Text style={styles.weekdayPickerLabel}>
            {resolveUiText(locale, "闹钟方式", "Alarm style")}
          </Text>
          <View style={styles.weekdayPickerRow}>
            {(
              [
                { id: "music" as const, label: resolveUiText(locale, "播放音乐", "Play music") },
                { id: "scripture" as const, label: resolveUiText(locale, "播放读经", "Play reading") },
              ] as const
            ).map((option) => {
              const selected = prefs.readingReminderMode === option.id;
              return (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [
                    styles.weekdayChip,
                    selected ? styles.weekdayChipSelected : null,
                    pressed ? styles.weekdayChipPressed : null,
                  ]}
                  onPress={() => onSetReadingReminderMode(option.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                >
                  <Text
                    style={[
                      styles.weekdayChipText,
                      selected ? styles.weekdayChipTextSelected : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.weekdayPickerLabel}>
            {resolveUiText(locale, "提醒日期", "Reminder days")}
          </Text>
          <View style={styles.weekdayPickerRow}>
            {READING_REMINDER_WEEKDAYS_ALL.map((weekday) => {
              const selected = prefs.readingReminderWeekdays.includes(weekday);
              return (
                <Pressable
                  key={weekday}
                  style={({ pressed }) => [
                    styles.weekdayChip,
                    selected ? styles.weekdayChipSelected : null,
                    pressed ? styles.weekdayChipPressed : null,
                  ]}
                  onPress={() => onToggleWeekday(weekday)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={WEEKDAY_LABELS[locale][weekday]}
                >
                  <Text
                    style={[
                      styles.weekdayChipText,
                      selected ? styles.weekdayChipTextSelected : null,
                    ]}
                  >
                    {WEEKDAY_LABELS[locale][weekday]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.compactGap} />

      <Pressable
        style={({ pressed }) => [styles.ttsMasterRow, pressed ? styles.ttsMasterRowPressed : null]}
        onPress={() => {
          void onToggleDailyVerse();
        }}
      >
        <Text style={styles.ttsMasterLabel}>
          {resolveUiText(locale, "每日金句通知", "Daily verse notification")}
        </Text>
        <Text style={styles.ttsMasterDetail}>
          {prefs.dailyVerseEnabled
            ? resolveUiText(locale, "已开启", "On")
            : resolveUiText(locale, "已关闭", "Off")}
        </Text>
      </Pressable>

      {prefs.dailyVerseEnabled ? (
        <View style={styles.ttsControlsWrap}>
          <Pressable
            style={({ pressed }) => [styles.ttsMasterRow, pressed ? styles.ttsMasterRowPressed : null]}
            onPress={() => toggleTimePicker("dailyVerse")}
          >
            <Text style={styles.ttsSliderLabel}>{resolveUiText(locale, "通知时间", "Time")}</Text>
            <Text style={styles.ttsSliderValue}>
              {formatTime(prefs.dailyVerseHour, prefs.dailyVerseMinute)}
            </Text>
          </Pressable>
          <InlineNotificationTimePicker
            visible={timePickerField === "dailyVerse"}
            hour={prefs.dailyVerseHour}
            minute={prefs.dailyVerseMinute}
            onChange={(event, date) => onTimeChange("dailyVerse", event, date)}
          />
        </View>
      ) : null}
    </>
  );
}
