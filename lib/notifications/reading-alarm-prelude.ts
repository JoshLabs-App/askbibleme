import { normalizeReadingAlarmPreludeSec } from "./reading-alarm-schedule";

/** Quiet front music before today's Scripture audio starts. */
export const DEFAULT_READING_ALARM_PRELUDE_SEC = 60;

export function readingAlarmPreludeMs(
  preludeSec: number = DEFAULT_READING_ALARM_PRELUDE_SEC,
): number {
  return normalizeReadingAlarmPreludeSec(preludeSec) * 1000;
}

export function waitReadingAlarmPrelude(
  isCancelled: () => boolean,
  preludeSec: number = DEFAULT_READING_ALARM_PRELUDE_SEC,
): Promise<void> {
  const preludeMs = readingAlarmPreludeMs(preludeSec);
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      if (isCancelled() || Date.now() - started >= preludeMs) {
        resolve();
        return;
      }
      setTimeout(tick, 200);
    };
    tick();
  });
}

export function readingAlarmPreludeSecondsRemaining(
  elapsedMs: number,
  preludeSec: number = DEFAULT_READING_ALARM_PRELUDE_SEC,
): number {
  return Math.max(0, Math.ceil((readingAlarmPreludeMs(preludeSec) - elapsedMs) / 1000));
}

/** @deprecated use {@link readingAlarmPreludeMs} */
export const READING_ALARM_PRELUDE_MS = readingAlarmPreludeMs();
