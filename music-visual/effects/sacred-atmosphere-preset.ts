import type { MusicVisualAtmospherePreset } from "../presets/atmosphere";
import type { MusicVisualAtmosphereScalars } from "../types/atmosphere-scalars";

/**
 * Sacred Atmosphere 片元里使用的标量（由氛围 preset 决定；与 uniforms 一一对应）。
 * 组合逻辑集中在此，避免 Canvas / shader 两侧各写一套 magic number。
 */
export function sacredAtmosphereScalarsFromPreset(
  preset: MusicVisualAtmospherePreset,
): MusicVisualAtmosphereScalars {
  return {
    fogSpeedMul: preset.fogSpeedMul,
    glowWeightMul: preset.glowWeightMul,
    particleDensityMul: preset.particleDensityMul,
  };
}
