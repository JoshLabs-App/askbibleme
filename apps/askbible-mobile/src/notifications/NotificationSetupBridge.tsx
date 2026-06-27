import { useNotificationSetup } from "./useNotificationSetup";

type Props = {
  enabled: boolean;
};

/** Mount once app shell is ready — wires notification scheduling and tap routing. */
export function NotificationSetupBridge({ enabled }: Props) {
  useNotificationSetup(enabled);
  return null;
}
