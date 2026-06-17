import type { Audio } from "expo-av";
import { logShellSoundError, safePlaySound } from "../audio/safeShellSound";
import type { CalmLoopProfile } from "./musicCalmLoopProfile";

export async function fadeSoundVolume(
  sound: Audio.Sound,
  from: number,
  to: number,
  durationMs: number,
): Promise<void> {
  if (durationMs <= 0) {
    try {
      await sound.setVolumeAsync(to);
    } catch {
      /* ignore */
    }
    return;
  }
  const steps = 24;
  const stepMs = Math.max(16, Math.floor(durationMs / steps));
  try {
    await sound.setVolumeAsync(from);
  } catch {
    return;
  }
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const eased = t * t * (3 - 2 * t);
    try {
      await sound.setVolumeAsync(from + (to - from) * eased);
    } catch {
      return;
    }
    if (i < steps) {
      await new Promise<void>((resolve) => setTimeout(resolve, stepMs));
    }
  }
}

export async function restartCalmLoopWithCrossfade(args: {
  sound: Audio.Sound;
  profile: CalmLoopProfile;
  fromVolume: number;
  targetGain: number;
  logTag?: string;
}): Promise<boolean> {
  const { sound, profile, fromVolume, targetGain, logTag } = args;
  await fadeSoundVolume(sound, fromVolume, 0, profile.crossfadeMs);
  try {
    await sound.setPositionAsync(profile.restartOffsetMs);
    await sound.setVolumeAsync(0);
  } catch (err) {
    if (logTag) logShellSoundError(`${logTag}-seek`, err);
    return false;
  }
  const ok = await safePlaySound(sound);
  if (!ok) return false;
  await fadeSoundVolume(sound, 0, targetGain, profile.crossfadeMs);
  return true;
}
