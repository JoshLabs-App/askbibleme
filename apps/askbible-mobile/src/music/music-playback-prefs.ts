import AsyncStorage from "@react-native-async-storage/async-storage";

const MUSIC_PLAYBACK_RESUME_KEY = "askbible-mobile-music-playback-resume-v1";
const SCRIPTURE_PLAYBACK_RATE_KEY = "askbible-mobile-scripture-playback-rate-v1";

export type MusicPlaybackResume = {
  trackId: string;
  positionSec: number;
};

export async function readMusicPlaybackResume(): Promise<MusicPlaybackResume | null> {
  try {
    const raw = await AsyncStorage.getItem(MUSIC_PLAYBACK_RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MusicPlaybackResume>;
    const trackId = typeof parsed.trackId === "string" ? parsed.trackId.trim() : "";
    const positionSec =
      typeof parsed.positionSec === "number" && Number.isFinite(parsed.positionSec)
        ? Math.max(0, parsed.positionSec)
        : 0;
    if (!trackId) return null;
    return { trackId, positionSec };
  } catch {
    return null;
  }
}

export async function writeMusicPlaybackResume(pos: MusicPlaybackResume): Promise<void> {
  const trackId = pos.trackId.trim();
  if (!trackId) return;
  const positionSec = Number.isFinite(pos.positionSec) ? Math.max(0, pos.positionSec) : 0;
  await AsyncStorage.setItem(MUSIC_PLAYBACK_RESUME_KEY, JSON.stringify({ trackId, positionSec }));
}

export const SCRIPTURE_PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function normalizeScripturePlaybackRate(raw: number | null | undefined): number {
  if (!Number.isFinite(raw)) return 1;
  const target = Number(raw);
  let best: (typeof SCRIPTURE_PLAYBACK_RATES)[number] = SCRIPTURE_PLAYBACK_RATES[0];
  let bestDist = Math.abs(best - target);
  for (const rate of SCRIPTURE_PLAYBACK_RATES) {
    const d = Math.abs(rate - target);
    if (d < bestDist) {
      best = rate;
      bestDist = d;
    }
  }
  return best;
}

export async function readScripturePlaybackRate(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SCRIPTURE_PLAYBACK_RATE_KEY);
    if (!raw) return 1;
    const parsed = JSON.parse(raw) as { rate?: number };
    return normalizeScripturePlaybackRate(parsed?.rate);
  } catch {
    return 1;
  }
}

export async function writeScripturePlaybackRate(rate: number): Promise<void> {
  const normalized = normalizeScripturePlaybackRate(rate);
  await AsyncStorage.setItem(SCRIPTURE_PLAYBACK_RATE_KEY, JSON.stringify({ rate: normalized }));
}

/** 续播落在曲末附近时视为已播完，从头再播。 */
export const MUSIC_RESUME_END_TOLERANCE_SEC = 4;

export function normalizeMusicResumeSec(resumeSec: number, durationSec: number | undefined): number {
  const resume = Math.max(0, resumeSec);
  if (!Number.isFinite(durationSec) || (durationSec ?? 0) <= 0) return resume;
  if (resume >= durationSec! - MUSIC_RESUME_END_TOLERANCE_SEC) return 0;
  return resume;
}

export function isMusicNearEnd(positionSec: number, durationSec: number | undefined): boolean {
  if (!Number.isFinite(durationSec) || (durationSec ?? 0) <= 0) return false;
  return positionSec >= durationSec! - MUSIC_RESUME_END_TOLERANCE_SEC;
}

export function durationSecFromLoadedStatus(
  trackDurationSec: number | undefined,
  durationMillis: number | null | undefined,
): number | undefined {
  if (typeof durationMillis === "number" && durationMillis > 0) {
    return durationMillis / 1000;
  }
  return trackDurationSec;
}
