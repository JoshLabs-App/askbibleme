/**
 * 氛围视觉预设（与首页「经卷/暮色」等 UI 预设可逐步对齐）。
 * 供引擎乘子与日后 AI 切换 atmosphere 使用。
 */
export type MusicVisualAtmospherePresetId =
  | "stillness"
  | "worship"
  | "night"
  | "hope"
  | "lament";

export type MusicVisualAtmospherePreset = {
  id: MusicVisualAtmospherePresetId;
  label: string;
  /** 雾相速度乘子 */
  fogSpeedMul: number;
  /** 光晕权重乘子 */
  glowWeightMul: number;
  /** 微粒密度乘子（0–1.5） */
  particleDensityMul: number;
};

export const MUSIC_VISUAL_ATMOSPHERE_PRESETS: MusicVisualAtmospherePreset[] = [
  { id: "stillness", label: "静", fogSpeedMul: 0.65, glowWeightMul: 0.85, particleDensityMul: 0.5 },
  { id: "worship", label: "敬拜", fogSpeedMul: 1, glowWeightMul: 1.05, particleDensityMul: 0.85 },
  { id: "night", label: "夜", fogSpeedMul: 0.8, glowWeightMul: 1.1, particleDensityMul: 0.7 },
  { id: "hope", label: "盼望", fogSpeedMul: 0.95, glowWeightMul: 1, particleDensityMul: 0.9 },
  { id: "lament", label: "哀歌", fogSpeedMul: 0.75, glowWeightMul: 0.9, particleDensityMul: 0.55 },
];

/** 默认 preset；供需要固定「敬拜」乘子的工具页或回退路径使用 */
export const DEFAULT_MUSIC_VISUAL_ATMOSPHERE_PRESET_ID: MusicVisualAtmospherePresetId = "worship";

export function getMusicVisualAtmospherePreset(
  id: MusicVisualAtmospherePresetId,
): MusicVisualAtmospherePreset {
  return MUSIC_VISUAL_ATMOSPHERE_PRESETS.find((p) => p.id === id) ?? MUSIC_VISUAL_ATMOSPHERE_PRESETS[1];
}
