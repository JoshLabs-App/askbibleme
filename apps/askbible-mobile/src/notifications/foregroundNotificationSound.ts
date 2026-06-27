import { isPlanFlowSessionActive } from "../read/read-plan-flow-autoplay";
import type { NotificationKind } from "./notification-constants";

const READING_ALARM_KINDS: NotificationKind[] = ["reading-reminder", "reading-alarm-auto-continue"];

/** planFlow 朗读中或前台读经闹钟：不播系统通知声，避免 duck / 打断经文。 */
export function shouldPlayForegroundNotificationSound(
  data: Record<string, unknown> | undefined,
): boolean {
  if (isPlanFlowSessionActive()) return false;
  const kind = data?.kind as NotificationKind | undefined;
  if (kind && READING_ALARM_KINDS.includes(kind)) return false;
  return true;
}
