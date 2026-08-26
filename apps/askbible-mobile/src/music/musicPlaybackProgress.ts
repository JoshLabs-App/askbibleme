export const MUSIC_PROGRESS_UI_INTERVAL_SEC = 0.25;
export const SCRIPTURE_PROGRESS_UI_INTERVAL_SEC = 0.5;

export function shouldEmitPlaybackSecUpdate(
  lastSecRef: { current: number },
  nextSec: number,
  intervalSec: number,
): boolean {
  if (lastSecRef.current < 0) {
    lastSecRef.current = nextSec;
    return true;
  }
  if (Math.abs(nextSec - lastSecRef.current) >= intervalSec) {
    lastSecRef.current = nextSec;
    return true;
  }
  return false;
}

export function formatPlaybackClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function formatWallClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
