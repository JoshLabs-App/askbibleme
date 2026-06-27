import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import { Linking as RnLinking } from "react-native";
import {
  READING_REMINDER_NOTIFICATION_ID,
  readingReminderWeekdayNotificationId,
} from "./notification-constants";
import {
  consumeReadingAlarmTrigger,
  startNativeReadingAlarmPrelude,
  stopNativeReadingAlarmSound,
  syncReadingAlarmSchedule,
} from "./syncAndroidReadingAlarmSchedule";
import { readNotificationPrefs, writeNotificationPrefs } from "./notification-prefs";
import { shouldStartReadingAlarmAudio } from "./readingAlarmPlayback";
import { rescheduleAllNotifications } from "./localNotificationScheduler";
import { requestNotificationPermissions } from "./notification-permissions";
import {
  READING_REMINDER_WEEKDAYS_ALL,
  type ReadingReminderWeekday,
} from "@/lib/notifications/notification-prefs-types";

const LOG = "[E2E-ReadingAlarm]";
export const RESULT_KEY = "askbible-e2e-reading-alarm-result-v1";
export const RUN_KEY = "askbible-e2e-reading-alarm-run-v1";

async function writeResult(status: "pass" | "fail", detail: string): Promise<void> {
  const payload = JSON.stringify({ status, detail, at: new Date().toISOString() });
  console.log(`${LOG} ${status.toUpperCase()} ${detail}`);
  try {
    await AsyncStorage.setItem(RESULT_KEY, payload);
  } catch {
    /* ignore */
  }
}

async function logNativeModuleSmoke(): Promise<boolean> {
  const mod = NativeModules.AskBibleReadingAlarm as Record<string, unknown> | undefined;
  if (!mod) {
    await writeResult("fail", `native module missing on ${Platform.OS}`);
    return false;
  }
  console.log(`${LOG} native module keys`, Object.keys(mod));
  startNativeReadingAlarmPrelude();
  await new Promise((r) => setTimeout(r, 2500));
  stopNativeReadingAlarmSound();
  await writeResult("pass", "native prelude smoke");
  return true;
}

async function scheduleForegroundReminder(seconds: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync("e2e-reading-reminder");
  await Notifications.scheduleNotificationAsync({
    identifier: "e2e-reading-reminder",
    content: {
      title: "Daily morning alarm",
      body: "E2E test",
      sound: true,
      data: { kind: "reading-reminder" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, seconds),
    },
  });
  console.log(`${LOG} scheduled foreground reminder in ${seconds}s`);
}

function readingReminderIds(scheduled: Notifications.NotificationRequest[]): string[] {
  return scheduled
    .filter(
      (item) =>
        item.identifier === READING_REMINDER_NOTIFICATION_ID ||
        item.identifier.startsWith("askbible-reading-reminder-wd-") ||
        item.content.data?.kind === "reading-reminder",
    )
    .map((item) => item.identifier);
}

async function listScheduledReadingReminderIds(): Promise<string[]> {
  if (Platform.OS === "ios") {
    const mod = NativeModules.AskBibleReadingAlarm as
      | { getPendingReadingReminderIds?: () => Promise<string[]> }
      | undefined;
    if (mod?.getPendingReadingReminderIds) {
      return mod.getPendingReadingReminderIds();
    }
  }
  return readingReminderIds(await Notifications.getAllScheduledNotificationsAsync());
}

async function verifyWeekdayScheduling(): Promise<boolean> {
  try {
    console.log(`${LOG} verifyWeekdayScheduling begin`);
    const permission = await Notifications.getPermissionsAsync();
    const granted =
      permission.granted ||
      permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      permission.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
    if (!granted && !__DEV__) {
      const requested = await requestNotificationPermissions();
      if (!requested) {
        await writeResult("fail", "notification permission denied");
        return false;
      }
    } else if (!granted && __DEV__) {
      await requestNotificationPermissions().catch(() => false);
    }

    const partialWeekdays: ReadingReminderWeekday[] = [2, 4, 6];
    const prefs = await readNotificationPrefs();
    const partialPrefs = {
      ...prefs,
      readingReminderEnabled: true,
      readingReminderWeekdays: partialWeekdays,
      readingReminderHour: 7,
      readingReminderMinute: 30,
      dailyVerseEnabled: false,
    };
    await writeNotificationPrefs(partialPrefs);
    await rescheduleAllNotifications();
    if (Platform.OS === "ios") {
      await new Promise((r) => setTimeout(r, 600));
    }

    const partialScheduled = await listScheduledReadingReminderIds();
    const partialWeeklyIds = partialWeekdays.map((weekday) => readingReminderWeekdayNotificationId(weekday));
    const hasDailyPartial = partialScheduled.includes(READING_REMINDER_NOTIFICATION_ID);
    const hasAllPartialWeekly = partialWeeklyIds.every((id) => partialScheduled.includes(id));
    const hasExtraPartialWeekly = READING_REMINDER_WEEKDAYS_ALL.filter(
      (weekday) => !partialWeekdays.includes(weekday),
    ).some((weekday) => partialScheduled.includes(readingReminderWeekdayNotificationId(weekday)));

    if (hasDailyPartial || !hasAllPartialWeekly || hasExtraPartialWeekly) {
      await writeResult(
        "fail",
        `partial weekdays daily=${hasDailyPartial} ids=${partialScheduled.join(",")}`,
      );
      return false;
    }

    const allPrefs = {
      ...partialPrefs,
      readingReminderWeekdays: [...READING_REMINDER_WEEKDAYS_ALL],
    };
    await writeNotificationPrefs(allPrefs);
    await rescheduleAllNotifications();
    if (Platform.OS === "ios") {
      await new Promise((r) => setTimeout(r, 600));
    }

    const allScheduled = await listScheduledReadingReminderIds();
    const hasDailyAll = allScheduled.includes(READING_REMINDER_NOTIFICATION_ID);
    const hasWeeklyAll = READING_REMINDER_WEEKDAYS_ALL.some((weekday) =>
      allScheduled.includes(readingReminderWeekdayNotificationId(weekday)),
    );

    if (!hasDailyAll || hasWeeklyAll) {
      await writeResult("fail", `all weekdays daily=${hasDailyAll} ids=${allScheduled.join(",")}`);
      return false;
    }

    await writeResult("pass", "weekdays scheduling");
    return true;
  } catch (error) {
    await writeResult("fail", error instanceof Error ? error.message : "weekdays scheduling error");
    return false;
  }
}

export async function runReadingAlarmE2E(mode: string): Promise<void> {
  console.log(`${LOG} start mode=${mode}`);
  const audioOk = await shouldStartReadingAlarmAudio();
  console.log(`${LOG} shouldStartReadingAlarmAudio=${audioOk}`);

  if (mode === "smoke" || mode === "full") {
    const ok = await logNativeModuleSmoke();
    if (!ok) return;
  }

  if (mode === "weekdays" || mode === "full") {
    const ok = await verifyWeekdayScheduling();
    if (!ok) return;
    if (mode === "weekdays") return;
  }

  if (mode === "sync" || mode === "full") {
    const prefs = await readNotificationPrefs();
    const next = { ...prefs, readingReminderEnabled: true };
    await writeNotificationPrefs(next);
    await syncReadingAlarmSchedule({
      prefs: next,
      enabled: true,
      title: "Daily morning alarm",
      body: "E2E sync test",
    });
    await writeResult("pass", "syncSchedule");
  }

  if (mode === "consume" || mode === "full") {
    const pending = await consumeReadingAlarmTrigger();
    console.log(`${LOG} consumeTrigger=${pending}`);
  }

  if (mode === "fire" || mode === "full") {
    await scheduleForegroundReminder(mode === "full" ? 8 : 5);
    await writeResult("pass", "scheduled foreground reminder");
  }

  if (mode === "prefs") {
    const prefs = await readNotificationPrefs();
    const d = new Date();
    d.setSeconds(d.getSeconds() + 90);
    const next = {
      ...prefs,
      readingReminderEnabled: true,
      readingReminderHour: d.getHours(),
      readingReminderMinute: d.getMinutes(),
    };
    await writeNotificationPrefs(next);
    await syncReadingAlarmSchedule({ prefs: next, enabled: true });
    await writeResult("pass", `prefs ${next.readingReminderHour}:${String(next.readingReminderMinute).padStart(2, "0")}`);
  }

  console.log(`${LOG} done mode=${mode}`);
}

function modeFromUrl(url: string): string | null {
  if (!url.includes("dev/reading-alarm")) return null;
  const parsed = Linking.parse(url);
  return typeof parsed.queryParams?.mode === "string" ? parsed.queryParams.mode : "full";
}

export function readingAlarmModeFromDevUrl(url: string): string | null {
  return modeFromUrl(url);
}

let pendingDevReadingAlarmMode: string | null = null;

function rememberDevReadingAlarmUrl(url: string | null | undefined): void {
  if (!__DEV__ || !url) return;
  const mode = readingAlarmModeFromDevUrl(url);
  if (mode) {
    pendingDevReadingAlarmMode = mode;
    console.log(`${LOG} queued pending dev mode=${mode}`);
  }
}

if (__DEV__) {
  void RnLinking.getInitialURL().then(rememberDevReadingAlarmUrl);
  void Linking.getInitialURL().then(rememberDevReadingAlarmUrl);
  RnLinking.addEventListener("url", ({ url }) => rememberDevReadingAlarmUrl(url));
  Linking.addEventListener("url", ({ url }) => rememberDevReadingAlarmUrl(url));
}

export async function runQueuedReadingAlarmDevE2E(): Promise<void> {
  if (!__DEV__) return;
  if (runQueuedReadingAlarmDevE2E.started) return;
  try {
    const pendingMode = pendingDevReadingAlarmMode;
    pendingDevReadingAlarmMode = null;

    const queued = await AsyncStorage.getItem(RUN_KEY);
    const mode = queued?.trim() || pendingMode;
    if (!mode) return;

    runQueuedReadingAlarmDevE2E.started = true;
    if (queued?.trim()) await AsyncStorage.removeItem(RUN_KEY);
    await runReadingAlarmE2E(mode);
  } catch (error) {
    await writeResult("fail", error instanceof Error ? error.message : "e2e runner error");
  } finally {
    runQueuedReadingAlarmDevE2E.started = false;
  }
}
runQueuedReadingAlarmDevE2E.started = false;

/** 兼容旧 Metro 增量缓存里残留的 import 名 */
export const runQueuedReadingAlarmDevE2ERunner = runQueuedReadingAlarmDevE2E;

export async function __devCancelE2EReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync("e2e-reading-reminder");
  await Notifications.cancelScheduledNotificationAsync(READING_REMINDER_NOTIFICATION_ID);
}
