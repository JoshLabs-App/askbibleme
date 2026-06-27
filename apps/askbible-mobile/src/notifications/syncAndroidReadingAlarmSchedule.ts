import { Platform } from "react-native";
import type { NotificationPrefsV1 } from "@/lib/notifications/notification-prefs-types";
import { resolveReadingAlarmChapterTarget } from "./resolveReadingAlarmChapterTarget";

type ReadingAlarmNativeModule = {
  syncSchedule?: (json: string) => void;
  fireReadingReminderNow?: () => void;
  consumeTrigger?: () => Promise<boolean>;
  peekTrigger?: () => Promise<boolean>;
  isPreludeActive?: () => Promise<boolean>;
  getPreludeSecondsRemaining?: () => Promise<number>;
  stopNativeAlertSound?: () => void;
  startPrelude?: () => void;
  dismissAlarm?: () => void;
  getPendingReadingReminderIds?: () => Promise<string[]>;
  maybeAutoStartDueAlarm?: () => Promise<boolean>;
  getCapabilities?: () => Promise<{
    canScheduleExactAlarms?: boolean;
    canUseFullScreenIntent?: boolean;
    notificationsGranted?: boolean;
  }>;
  openExactAlarmSettings?: () => void;
  openFullScreenIntentSettings?: () => void;
  getScheduledChapterTarget?: () => Promise<{
    bookId?: string;
    chapter?: number;
    bookName?: string;
    translationId?: string;
    label?: string;
  } | null>;
};

function getModule(): ReadingAlarmNativeModule | undefined {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return undefined;
  try {
    const { NativeModules } = require("react-native") as typeof import("react-native");
    return NativeModules.AskBibleReadingAlarm as ReadingAlarmNativeModule | undefined;
  } catch {
    return undefined;
  }
}

export async function syncReadingAlarmSchedule(args: {
  prefs: NotificationPrefsV1;
  enabled: boolean;
  skipToday?: boolean;
  title?: string;
  body?: string;
}): Promise<void> {
  const mod = getModule();
  if (!mod?.syncSchedule) return;

  const useNativeAlarm = args.enabled && !args.skipToday;
  let target: Awaited<ReturnType<typeof resolveReadingAlarmChapterTarget>> = null;
  if (useNativeAlarm) {
    try {
      target = await resolveReadingAlarmChapterTarget();
    } catch {
      target = null;
    }
  }

  mod.syncSchedule(
    JSON.stringify({
      enabled: useNativeAlarm,
      hour: args.prefs.readingReminderHour,
      minute: args.prefs.readingReminderMinute,
      weekdays: args.prefs.readingReminderWeekdays,
      title: args.title ?? "",
      body: args.body ?? "",
      label: target?.label ?? "",
      bookId: target?.bookId ?? "",
      chapter: target?.chapter ?? 1,
      bookName: target?.bookName ?? "",
      translationId: target?.translationId ?? "cuv-simp",
      mode: args.prefs.readingReminderMode,
    }),
  );
}

/** @deprecated use {@link syncReadingAlarmSchedule} */
export const syncAndroidReadingAlarmSchedule = syncReadingAlarmSchedule;

export async function maybeAutoStartDueReadingAlarm(): Promise<boolean> {
  const mod = getModule();
  if (!mod?.maybeAutoStartDueAlarm) return false;
  try {
    return Boolean(await mod.maybeAutoStartDueAlarm());
  } catch {
    return false;
  }
}

/** 本地通知触发时走原生预备音乐 / 全屏闹钟链路。 */
export function fireNativeReadingAlarmFromNotification(): void {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  try {
    getModule()?.fireReadingReminderNow?.();
  } catch {
    /* ignore */
  }
}

export async function consumeReadingAlarmTrigger(): Promise<boolean> {
  const mod = getModule();
  if (!mod?.consumeTrigger) return false;
  try {
    return Boolean(await mod.consumeTrigger());
  } catch {
    return false;
  }
}

export async function peekReadingAlarmTrigger(): Promise<boolean> {
  const mod = getModule();
  if (!mod?.peekTrigger) return false;
  try {
    return Boolean(await mod.peekTrigger());
  } catch {
    return false;
  }
}

export async function getNativeScheduledChapterTarget(): Promise<{
  bookId: string;
  chapter: number;
  bookName: string;
  translationId: string;
  label: string;
} | null> {
  const mod = getModule();
  if (!mod?.getScheduledChapterTarget) return null;
  try {
    const raw = await mod.getScheduledChapterTarget();
    const bookId = String(raw?.bookId ?? "").trim();
    if (!bookId) return null;
    const chapter = Number(raw?.chapter);
    return {
      bookId,
      chapter: Number.isInteger(chapter) && chapter > 0 ? chapter : 1,
      bookName: String(raw?.bookName ?? "").trim(),
      translationId: String(raw?.translationId ?? "cuv-simp").trim() || "cuv-simp",
      label: String(raw?.label ?? "").trim(),
    };
  } catch {
    return null;
  }
}

/** @deprecated use {@link consumeReadingAlarmTrigger} */
export const consumeAndroidReadingAlarmTrigger = consumeReadingAlarmTrigger;

export function stopNativeReadingAlarmSound(): void {
  getModule()?.stopNativeAlertSound?.();
}

/** @deprecated use {@link stopNativeReadingAlarmSound} */
export const stopAndroidNativeReadingAlarmSound = stopNativeReadingAlarmSound;

export function startNativeReadingAlarmPrelude(): boolean {
  const mod = getModule();
  if (!mod?.startPrelude) return false;
  try {
    mod.startPrelude();
    return true;
  } catch {
    return false;
  }
}

export async function getNativeReadingAlarmPreludeSecondsRemaining(): Promise<number> {
  const mod = getModule();
  if (!mod?.getPreludeSecondsRemaining) return 0;
  try {
    const raw = await mod.getPreludeSecondsRemaining();
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export async function isNativeReadingAlarmPreludeActive(): Promise<boolean> {
  const mod = getModule();
  if (!mod?.isPreludeActive) return false;
  try {
    return Boolean(await mod.isPreludeActive());
  } catch {
    return false;
  }
}

function subscribeReadingAlarmEvent(
  eventName:
    | "ReadingAlarmDismissed"
    | "ReadingAlarmAutoContinue"
    | "ReadingAlarmPreludeSession",
  onEvent: () => void,
): () => void {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return () => {};
  try {
    const { NativeEventEmitter, NativeModules } = require("react-native") as typeof import("react-native");
    const mod = NativeModules.AskBibleReadingAlarm;
    if (!mod) return () => {};
    const emitter = new NativeEventEmitter(mod);
    const sub = emitter.addListener(eventName, onEvent);
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

export function subscribeReadingAlarmDismissed(onDismiss: () => void): () => void {
  return subscribeReadingAlarmEvent("ReadingAlarmDismissed", onDismiss);
}

/** @deprecated use {@link subscribeReadingAlarmDismissed} */
export const subscribeAndroidReadingAlarmDismissed = subscribeReadingAlarmDismissed;

export function subscribeReadingAlarmAutoContinue(onContinue: () => void): () => void {
  return subscribeReadingAlarmEvent("ReadingAlarmAutoContinue", onContinue);
}

export function subscribeReadingAlarmPreludeSession(onPrelude: () => void): () => void {
  return subscribeReadingAlarmEvent("ReadingAlarmPreludeSession", onPrelude);
}
