import AsyncStorage from "@react-native-async-storage/async-storage";

const MUSIC_PLAYBACK_RESUME_KEY = "askbible-mobile-music-playback-resume-v1";

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
