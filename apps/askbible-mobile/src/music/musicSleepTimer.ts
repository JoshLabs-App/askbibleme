import type { ShellSleepTimerMinutes } from "./musicPlaybackTypes";

export function cycleShellSleepTimerMinutes(
  current: 0 | ShellSleepTimerMinutes,
): 0 | ShellSleepTimerMinutes {
  if (current === 0) return 15;
  if (current === 15) return 30;
  if (current === 30) return 60;
  if (current === 60) return 120;
  return 0;
}

export function sleepTimerBadgeText(minutes: 0 | ShellSleepTimerMinutes): string | null {
  return minutes > 0 ? String(minutes) : null;
}
