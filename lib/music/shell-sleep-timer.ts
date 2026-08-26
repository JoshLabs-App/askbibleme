import type { MusicShellSleepTimerMinutes } from "@/components/music/MusicShellPlaybackContext";

export function cycleShellSleepTimerMinutes(
  current: MusicShellSleepTimerMinutes,
): MusicShellSleepTimerMinutes {
  if (current === 0) return 15;
  if (current === 15) return 30;
  if (current === 30) return 60;
  if (current === 60) return 120;
  return 0;
}
