import { readNotificationPrefs } from "./notification-prefs";
import type { ReadingReminderMode } from "@/lib/notifications/notification-prefs-types";

export type ActiveReadingAlarm = {
  bookId: string;
  chapter: number;
  bookName: string;
  translationId: string;
  label: string;
  verseText?: string;
  verseRef?: string;
};

export async function shouldStartReadingAlarmAudio(): Promise<boolean> {
  const prefs = await readNotificationPrefs();
  return prefs.readingReminderEnabled;
}

export async function getReadingReminderMode(): Promise<ReadingReminderMode> {
  const prefs = await readNotificationPrefs();
  return prefs.readingReminderMode;
}
