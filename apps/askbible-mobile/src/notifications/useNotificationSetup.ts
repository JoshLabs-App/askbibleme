import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { subscribeReadingHabitStats } from "../read/reading-habit-stats";
import { subscribeHomePrayerVersePrefs } from "../home/homePrayerVersePrefs";
import { subscribeHomeVersePoolScope } from "../home/homeVersePoolScopePrefs";
import { subscribeHomeVerseRotationSec } from "../home/homeVerseRotationPrefs";
import { subscribeNotificationPrefs } from "./notification-prefs";
import { rescheduleAllNotifications } from "./localNotificationScheduler";
import {
  configureForegroundNotificationPresentation,
  requestNotificationPermissions,
} from "./notification-permissions";
import type { NotificationKind } from "./notification-constants";
import { syncDailyVerseWidgetSnapshot } from "../widget/syncDailyVerseWidgetSnapshot";

function routeForNotificationKind(kind: NotificationKind | undefined, router: ReturnType<typeof useRouter>) {
  if (kind === "reading-reminder") {
    router.push("/(tabs)/read");
    return;
  }
  if (kind === "daily-verse") {
    router.push("/(tabs)");
  }
}

export function useNotificationSetup(enabled: boolean): void {
  const router = useRouter();
  const rescheduleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    configureForegroundNotificationPresentation();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const queueReschedule = () => {
      if (rescheduleTimer.current) clearTimeout(rescheduleTimer.current);
      rescheduleTimer.current = setTimeout(() => {
        void rescheduleAllNotifications();
        void syncDailyVerseWidgetSnapshot();
      }, 250);
    };

    queueReschedule();

    const unsubPrefs = subscribeNotificationPrefs(queueReschedule);
    const unsubHabit = subscribeReadingHabitStats(queueReschedule);
    const unsubVersePrefs = subscribeHomePrayerVersePrefs(queueReschedule);
    const unsubScope = subscribeHomeVersePoolScope(queueReschedule);
    const unsubRotation = subscribeHomeVerseRotationSec(queueReschedule);

    const onAppState = (state: AppStateStatus) => {
      if (state === "active") queueReschedule();
    };
    const appStateSub = AppState.addEventListener("change", onAppState);

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const kind = response.notification.request.content.data?.kind as NotificationKind | undefined;
      routeForNotificationKind(kind, router);
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const kind = response.notification.request.content.data?.kind as NotificationKind | undefined;
      routeForNotificationKind(kind, router);
    });

    return () => {
      unsubPrefs();
      unsubHabit();
      unsubVersePrefs();
      unsubScope();
      unsubRotation();
      appStateSub.remove();
      responseSub.remove();
      if (rescheduleTimer.current) clearTimeout(rescheduleTimer.current);
    };
  }, [enabled, router]);
}

export async function ensureNotificationsEnabledForPrefsToggle(): Promise<boolean> {
  return requestNotificationPermissions();
}
