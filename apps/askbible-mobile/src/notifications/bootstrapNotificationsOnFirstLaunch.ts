import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notifications/notification-prefs-types";
import {
  NOTIFICATION_BOOTSTRAP_STORAGE_KEY,
  NOTIFICATION_PREFS_STORAGE_KEY,
} from "./notification-constants";
import { readNotificationPrefs, writeNotificationPrefs } from "./notification-prefs";
import { requestNotificationPermissions } from "./notification-permissions";
import { rescheduleAllNotifications } from "./localNotificationScheduler";

/**
 * Fresh install only: persist opt-in reminder defaults (8:00) and show the OS permission dialog once.
 * Existing installs with saved prefs are not overwritten or re-prompted.
 */
export async function bootstrapNotificationsOnFirstLaunch(): Promise<void> {
  const bootstrapped = await AsyncStorage.getItem(NOTIFICATION_BOOTSTRAP_STORAGE_KEY);
  if (bootstrapped === "1") return;

  const rawPrefs = await AsyncStorage.getItem(NOTIFICATION_PREFS_STORAGE_KEY);
  const isFreshInstall = !rawPrefs?.trim();

  await AsyncStorage.setItem(NOTIFICATION_BOOTSTRAP_STORAGE_KEY, "1");

  if (isFreshInstall) {
    await writeNotificationPrefs(DEFAULT_NOTIFICATION_PREFS);
    await requestNotificationPermissions();
  } else {
    await readNotificationPrefs();
  }

  await rescheduleAllNotifications();
}
