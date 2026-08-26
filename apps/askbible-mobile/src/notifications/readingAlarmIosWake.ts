import {
  isNativeReadingAlarmPreludeActive,
  maybeAutoStartDueReadingAlarm,
  peekReadingAlarmTrigger,
} from "./syncAndroidReadingAlarmSchedule";
import { resolveReadingAlarmWakeKind, type ReadingAlarmWakeKind } from "./readingAlarmWake";

/** 解锁 / 回前台时：接上原生预备音乐，或进入已到期的读经交接。双端同一套判断。 */
export async function tryWakeReadingAlarmOnActive(): Promise<ReadingAlarmWakeKind> {
  const pendingTrigger = await peekReadingAlarmTrigger();
  const preludeActive = await isNativeReadingAlarmPreludeActive();
  if (pendingTrigger || preludeActive) {
    return resolveReadingAlarmWakeKind({
      pendingTrigger,
      preludeActive,
      dueStarted: false,
    });
  }

  const dueStarted = await maybeAutoStartDueReadingAlarm();
  return resolveReadingAlarmWakeKind({
    pendingTrigger: false,
    preludeActive: false,
    dueStarted,
  });
}
