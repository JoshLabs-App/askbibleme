import { Platform } from "react-native";
import {
  isNativeReadingAlarmPreludeActive,
  getNativeReadingAlarmPreludeSecondsRemaining,
  maybeAutoStartDueReadingAlarm,
  peekReadingAlarmTrigger,
} from "./syncAndroidReadingAlarmSchedule";

/** 解锁 / 回前台时：补启动闹钟预备音乐，或接续已完成的预备段进入读经。 */
export async function tryWakeReadingAlarmOnActive(): Promise<
  "started" | "handoff" | "prelude-sync" | "none"
> {
  if (Platform.OS !== "ios") return "none";

  if (await peekReadingAlarmTrigger()) {
    return "handoff";
  }

  if (await isNativeReadingAlarmPreludeActive()) {
    return "prelude-sync";
  }

  const started = await maybeAutoStartDueReadingAlarm();
  return started ? "started" : "none";
}
