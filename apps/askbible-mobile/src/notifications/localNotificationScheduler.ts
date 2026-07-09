import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getLocale } from "../i18n/locale-store";
import { resolveUiText } from "../i18n/site-copy";
import {
  ANDROID_CHANNEL_DAILY_VERSE,
  ANDROID_CHANNEL_READING_REMINDER,
  DAILY_VERSE_NOTIFICATION_ID,
  READING_REMINDER_NOTIFICATION_ID,
  readingReminderWeekdayNotificationId,
  type NotificationKind,
} from "./notification-constants";
import { readNotificationPrefs } from "./notification-prefs";
import { syncReadingAlarmSchedule } from "./syncAndroidReadingAlarmSchedule";
import {
  formatDailyVerseNotificationBody,
  resolveDailyVerseForDate,
} from "./resolve-daily-verse-for-date";
import {
  isAllReadingReminderWeekdays,
  READING_REMINDER_WEEKDAYS_ALL,
} from "@/lib/notifications/notification-prefs-types";

let androidChannelsReady = false;

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android" || androidChannelsReady) return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_READING_REMINDER, {
    name: "Daily morning alarm",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 500, 250],
    lightColor: "#ECD9B9",
  });
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_DAILY_VERSE, {
    name: "Daily verse",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lightColor: "#ECD9B9",
  });
  androidChannelsReady = true;
}

function readingReminderCopy(locale: ReturnType<typeof getLocale>) {
  return {
    title: resolveUiText(locale, "每日清晨闹钟", "Daily morning alarm"),
    body: resolveUiText(
      locale,
      "今天可以安静读一会儿经。",
      "A quiet moment to read Scripture today.",
    ),
  };
}

function dailyVerseTitle(locale: ReturnType<typeof getLocale>): string {
  return resolveUiText(locale, "今日金句", "Verse of the day");
}

async function cancelNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* ignore */
  }
}

async function scheduleDailyTrigger(args: {
  identifier: string;
  hour: number;
  minute: number;
  title: string;
  body: string;
  kind: NotificationKind;
  channelId?: string;
}): Promise<void> {
  await cancelNotification(args.identifier);
  await Notifications.scheduleNotificationAsync({
    identifier: args.identifier,
    content: {
      title: args.title,
      body: args.body,
      sound: true,
      data: { kind: args.kind },
      ...(Platform.OS === "android" && args.channelId
        ? { channelId: args.channelId }
        : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: args.hour,
      minute: args.minute,
    },
  });
}

async function scheduleWeeklyTrigger(args: {
  identifier: string;
  weekday: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
  kind: NotificationKind;
  channelId?: string;
}): Promise<void> {
  await cancelNotification(args.identifier);
  await Notifications.scheduleNotificationAsync({
    identifier: args.identifier,
    content: {
      title: args.title,
      body: args.body,
      sound: true,
      data: { kind: args.kind },
      ...(Platform.OS === "android" && args.channelId
        ? { channelId: args.channelId }
        : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: args.weekday,
      hour: args.hour,
      minute: args.minute,
    },
  });
}

async function cancelAllReadingReminderNotifications(): Promise<void> {
  await cancelNotification(READING_REMINDER_NOTIFICATION_ID);
  for (const weekday of READING_REMINDER_WEEKDAYS_ALL) {
    await cancelNotification(readingReminderWeekdayNotificationId(weekday));
  }
}

async function scheduleReadingReminderNotifications(args: {
  hour: number;
  minute: number;
  weekdays: readonly number[];
  title: string;
  body: string;
}): Promise<void> {
  await cancelAllReadingReminderNotifications();
  const common = {
    hour: args.hour,
    minute: args.minute,
    title: args.title,
    body: args.body,
    kind: "reading-reminder" as const,
    channelId: ANDROID_CHANNEL_READING_REMINDER,
  };

  if (isAllReadingReminderWeekdays(args.weekdays)) {
    await scheduleDailyTrigger({
      identifier: READING_REMINDER_NOTIFICATION_ID,
      ...common,
    });
    return;
  }

  for (const weekday of args.weekdays) {
    await scheduleWeeklyTrigger({
      identifier: readingReminderWeekdayNotificationId(weekday),
      weekday,
      ...common,
    });
  }
}

export async function rescheduleAllNotifications(): Promise<void> {
  await ensureAndroidChannels();
  const prefs = await readNotificationPrefs();
  const locale = getLocale();

  if (!prefs.readingReminderEnabled) {
    await cancelAllReadingReminderNotifications();
    await syncReadingAlarmSchedule({ prefs, enabled: false });
  } else {
    const copy = readingReminderCopy(locale);
    if (Platform.OS === "ios") {
      // iOS: native UNUserNotificationCenter scheduling in AskBibleReadingAlarmModule.
      await cancelAllReadingReminderNotifications();
      await syncReadingAlarmSchedule({
        prefs,
        enabled: true,
        title: copy.title,
        body: copy.body,
      });
    } else {
      await scheduleReadingReminderNotifications({
        hour: prefs.readingReminderHour,
        minute: prefs.readingReminderMinute,
        weekdays: prefs.readingReminderWeekdays,
        title: copy.title,
        body: copy.body,
      });
      await syncReadingAlarmSchedule({ prefs, enabled: true });
    }
  }

  if (!prefs.dailyVerseEnabled) {
    await cancelNotification(DAILY_VERSE_NOTIFICATION_ID);
    return;
  }

  const snapshot = await resolveDailyVerseForDate();
  const body = snapshot
    ? formatDailyVerseNotificationBody(snapshot)
    : resolveUiText(locale, "打开 AskBible.me 查看今日金句。", "Open AskBible.me for today's verse.");

  await scheduleDailyTrigger({
    identifier: DAILY_VERSE_NOTIFICATION_ID,
    hour: prefs.dailyVerseHour,
    minute: prefs.dailyVerseMinute,
    title: dailyVerseTitle(locale),
    body,
    kind: "daily-verse",
    channelId: ANDROID_CHANNEL_DAILY_VERSE,
  });
}

export async function cancelAllAskBibleNotifications(): Promise<void> {
  await cancelAllReadingReminderNotifications();
  await cancelNotification(DAILY_VERSE_NOTIFICATION_ID);
}
