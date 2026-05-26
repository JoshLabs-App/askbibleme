import { Audio, type AVPlaybackStatus } from "expo-av";
import { configureShellAudioMode } from "./shellAudioMode";

/** expo-av 在 unload / 切源并发时常见；避免冒泡成红屏 Uncaught (in promise)。 */
export function isBenignShellSoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /interrupt|not loaded|not yet loaded|Seeking/i.test(msg);
}

export function logShellSoundError(scope: string, err: unknown): void {
  if (!__DEV__ || isBenignShellSoundError(err)) return;
  console.warn(`[playback] ${scope}`, err);
}

export async function safeGetSoundStatus(
  sound: Audio.Sound,
): Promise<AVPlaybackStatus | null> {
  try {
    return await sound.getStatusAsync();
  } catch (err) {
    logShellSoundError("getStatus", err);
    return null;
  }
}

export async function safePauseSound(sound: Audio.Sound): Promise<void> {
  try {
    const st = await sound.getStatusAsync();
    if (st.isLoaded && st.isPlaying) await sound.pauseAsync();
  } catch (err) {
    logShellSoundError("pause", err);
  }
}

export async function safePlaySound(sound: Audio.Sound): Promise<boolean> {
  const attempt = async (): Promise<boolean> => {
    const st = await sound.getStatusAsync();
    if (!st.isLoaded) return false;
    await sound.playAsync();
    return true;
  };
  try {
    return await attempt();
  } catch (err) {
    if (!isBenignShellSoundError(err)) {
      try {
        await configureShellAudioMode();
        return await attempt();
      } catch (retryErr) {
        logShellSoundError("play-retry", retryErr);
      }
    }
    logShellSoundError("play", err);
    return false;
  }
}

export async function safeStopAndUnloadSound(sound: Audio.Sound): Promise<void> {
  try {
    await sound.stopAsync();
  } catch (err) {
    logShellSoundError("stop", err);
  }
  try {
    await sound.unloadAsync();
  } catch (err) {
    logShellSoundError("unload", err);
  }
}

export async function safeSeekSoundRatio(sound: Audio.Sound, ratio: number): Promise<boolean> {
  try {
    const st = await sound.getStatusAsync();
    if (!st.isLoaded || st.durationMillis == null || st.durationMillis <= 0) return false;
    const clamped = Math.max(0, Math.min(1, ratio));
    await sound.setPositionAsync(clamped * st.durationMillis);
    return true;
  } catch (err) {
    logShellSoundError("seek", err);
    return false;
  }
}
