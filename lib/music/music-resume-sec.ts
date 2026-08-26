/** 续播落在曲末附近时视为已播完，从头再播。 */
export const MUSIC_RESUME_END_TOLERANCE_SEC = 4;

export function normalizeMusicResumeSec(resumeSec: number, durationSec: number | undefined): number {
  const resume = Math.max(0, resumeSec);
  if (!Number.isFinite(durationSec) || (durationSec ?? 0) <= 0) return resume;
  if (resume >= durationSec! - MUSIC_RESUME_END_TOLERANCE_SEC) return 0;
  return resume;
}
