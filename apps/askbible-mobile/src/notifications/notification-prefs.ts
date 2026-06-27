import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_NOTIFICATION_PREFS,
  normalizeNotificationPrefs,
  type NotificationPrefsV1,
} from "@/lib/notifications/notification-prefs-types";
import { NOTIFICATION_PREFS_STORAGE_KEY } from "./notification-constants";

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

let cached: NotificationPrefsV1 = DEFAULT_NOTIFICATION_PREFS;

export function getCachedNotificationPrefs(): NotificationPrefsV1 {
  return cached;
}

export function subscribeNotificationPrefs(onStore: () => void): () => void {
  listeners.add(onStore);
  return () => listeners.delete(onStore);
}

export async function readNotificationPrefs(): Promise<NotificationPrefsV1> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_PREFS_STORAGE_KEY);
    if (!raw?.trim()) {
      cached = DEFAULT_NOTIFICATION_PREFS;
      return cached;
    }
    cached = normalizeNotificationPrefs(JSON.parse(raw));
    return cached;
  } catch {
    cached = DEFAULT_NOTIFICATION_PREFS;
    return cached;
  }
}

export async function writeNotificationPrefs(next: NotificationPrefsV1): Promise<void> {
  const normalized = normalizeNotificationPrefs(next);
  cached = normalized;
  try {
    await AsyncStorage.setItem(NOTIFICATION_PREFS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore persistence failures */
  }
  emit();
}

export async function hydrateNotificationPrefs(): Promise<NotificationPrefsV1> {
  return readNotificationPrefs();
}
