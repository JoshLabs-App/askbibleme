import type { IUniform } from "three";
import { IDLE_MUSIC_VISUAL_DRIVE } from "@/music-visual/types/drive";

/** Sacred atmosphere 全屏 shader 的 uniform 契约（单一来源，避免 JSX 里散落 magic string） */
export type SacredAtmosphereUniforms = {
  uTime: IUniform<number>;
  uRms: IUniform<number>;
  uLow: IUniform<number>;
  uMid: IUniform<number>;
  uHigh: IUniform<number>;
  uStill: IUniform<number>;
  uMaster: IUniform<number>;
  /** 来自 `MusicVisualAtmospherePreset.fogSpeedMul`（首页氛围映射后写入） */
  uFogSpeedMul: IUniform<number>;
  /** 来自 preset.glowWeightMul */
  uGlowWeightMul: IUniform<number>;
  /** 来自 preset.particleDensityMul */
  uParticleDensityMul: IUniform<number>;
};

export function createSacredAtmosphereUniforms(): SacredAtmosphereUniforms {
  return {
    uTime: { value: 0 },
    uRms: { value: IDLE_MUSIC_VISUAL_DRIVE.rms },
    uLow: { value: 0 },
    uMid: { value: 0 },
    uHigh: { value: 0 },
    uStill: { value: 0 },
    uMaster: { value: 1 },
    uFogSpeedMul: { value: 1 },
    uGlowWeightMul: { value: 1 },
    uParticleDensityMul: { value: 1 },
  };
}
