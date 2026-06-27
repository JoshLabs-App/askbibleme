import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { shouldPlayForegroundNotificationSound } from "./foregroundNotificationSound";

export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const settings = await Notifications.getPermissionsAsync();
  return settings.status;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;

  const next = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return (
    next.granted ||
    next.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    next.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED
  );
}

export async function ensureNotificationsEnabledForPrefsToggle(): Promise<boolean> {
  return requestNotificationPermissions();
}

export function configureForegroundNotificationPresentation(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const playSound = shouldPlayForegroundNotificationSound(
        notification.request.content.data as Record<string, unknown> | undefined,
      );
      return {
        shouldShowAlert: true,
        shouldPlaySound: playSound,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });
}
