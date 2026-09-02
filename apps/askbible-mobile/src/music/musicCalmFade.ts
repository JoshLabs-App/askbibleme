import type { AudioPlayer } from "expo-audio";
import { logShellSoundError, safePlaySound } from "../audio/safeShellSound";
import type { CalmLoopProfile } from "./musicCalmLoopProfile";

export async function fadeSoundVolume(
  sound: AudioPlayer,
  from: number,
  to: number,
  durationMs: number,
): Promise<void> {
  if (durationMs <= 0) {
    try {
      sound.volume = to;
    } catch {
      /* ignore */
    }
    return;
  }
  const steps = 24;
  const stepMs = Math.max(16, Math.floor(durationMs / steps));
  try {
    sound.volume = from;
  } catch {
    return;
  }
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const eased = t * t * (3 - 2 * t);
    try {
      sound.volume = from + (to - from) * eased;
    } catch {
      return;
    }
    if (i < steps) {
      await new Promise<void>((resolve) => setTimeout(resolve, stepMs));
    }
  }
}

export async function restartCalmLoopWithCrossfade(args: {
  sound: AudioPlayer;
  profile: CalmLoopProfile;
  fromVolume: number;
  targetGain: number;
  logTag?: string;
}): Promise<boolean> {
  const { sound, profile, fromVolume, targetGain, logTag } = args;
  await fadeSoundVolume(sound, fromVolume, 0, profile.crossfadeMs);
  try {
    await sound.seekTo(profile.restartOffsetMs / 1000);
    sound.volume = 0;
  } catch (err) {
    if (logTag) logShellSoundError(`${logTag}-seek`, err);
    return false;
  }
  const ok = await safePlaySound(sound);
  if (!ok) return false;
  await fadeSoundVolume(sound, 0, targetGain, profile.crossfadeMs);
  return true;
}
