import type { NatureAmbientSceneSlotId } from "./ambientSceneSlots";

/**
 * 环境音源文件响度差很大（约 -12 ~ -55 LUFS）。
 * Expo volume 只能 0~1 衰减，以雨/鸟/白噪音约 -36~-38 LUFS 为基准压响轨。
 * 「水」源文件过弱，无法靠抬增益对齐（另案再修源文件）。
 *
 * 相对历史基准整体再 ×0.8（调小约 20%）。
 */
export const AMBIENT_SCENE_PLAYBACK_GAIN: Record<NatureAmbientSceneSlotId, number> = {
  "scene-fire": 0.056,
  "scene-waves": 0.16,
  "scene-wind": 0.088,
  "scene-thunder": 0.168,
  "scene-cafe": 0.52,
  "scene-white-noise": 0.8,
  "scene-rain": 0.8,
  "scene-birds": 0.8,
  "scene-water": 0.8,
};

export function ambientScenePlaybackGain(slotId: NatureAmbientSceneSlotId): number {
  const g = AMBIENT_SCENE_PLAYBACK_GAIN[slotId];
  if (!Number.isFinite(g)) return 0.8;
  return Math.max(0, Math.min(1, g));
}
