import { getPlaybackSnapshot, isStreamLit } from "../audio/playbackState";
import {
  clearNatureAmbientSlot,
  getNatureAmbientSlotId,
} from "../nature/natureAmbientExclusiveStop";

let sessionActive = false;

/** 首页金句开关（点了即可，不必等音轨真正出声）。 */
export function setHomeGoldenVerseSessionActive(next: boolean): void {
  sessionActive = next;
}

export function isHomeGoldenVerseAudioOpen(): boolean {
  const verse = getPlaybackSnapshot().verse;
  return sessionActive || isStreamLit(verse);
}

/** 金句或章朗读：都算「人声」这一路。 */
export function isHomeVoiceAudible(): boolean {
  const scripture = getPlaybackSnapshot().scripture;
  return isHomeGoldenVerseAudioOpen() || isStreamLit(scripture);
}

export function isHomeMusicAudible(): boolean {
  const music = getPlaybackSnapshot().music;
  return isStreamLit(music);
}

export function isHomeAmbientActive(): boolean {
  return Boolean(getNatureAmbientSlotId());
}

/**
 * 首页最多两路有声：环境音+金句、环境音+音乐、音乐+金句 均可；
 * 不允许音乐+金句+环境音同时出声。
 */

/** 开音乐时若金句与环境音都在，关掉环境音。 */
export function yieldAmbientIfVerseAndAmbientOpen(): void {
  if (!isHomeGoldenVerseAudioOpen() || !isHomeAmbientActive()) return;
  clearNatureAmbientSlot();
}

/** 开金句时若音乐与环境音都在，关掉环境音。 */
export function yieldAmbientIfMusicAndAmbientOpen(): void {
  if (!isHomeMusicAudible() || !isHomeAmbientActive()) return;
  clearNatureAmbientSlot();
}

/**
 * 开环境音时若人声（金句/读经）与音乐都在，必须停音乐。
 * 三路不能同时出声；留下人声+环境音。
 */
export function shouldYieldMusicWhenOpeningAmbient(): boolean {
  return isHomeVoiceAudible() && isHomeMusicAudible();
}
