import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { getLocale } from "../i18n/locale-store";
import type { ActiveReadingAlarm } from "./readingAlarmPlayback";
import { resolveReadingAlarmChapterTarget } from "./resolveReadingAlarmChapterTarget";
import { getNativeScheduledChapterTarget } from "./syncAndroidReadingAlarmSchedule";

function enrichAlarmTarget(target: ActiveReadingAlarm): ActiveReadingAlarm {
  const bookName = target.bookName?.trim() || getScriptureBookDisplayName(target.bookId, getLocale());
  const label = target.label?.trim() || `${bookName} ${target.chapter}`;
  return { ...target, bookName, label };
}

/** 优先用原生闹钟同步时写入的章节（冷启动更稳），否则再算今日计划。 */
export async function resolveAlarmChapterTarget(): Promise<ActiveReadingAlarm | null> {
  const native = await getNativeScheduledChapterTarget();
  if (native?.bookId) return enrichAlarmTarget(native);
  const resolved = await resolveReadingAlarmChapterTarget();
  return resolved ? enrichAlarmTarget(resolved) : null;
}
