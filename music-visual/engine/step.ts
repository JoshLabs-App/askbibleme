import type { MusicVisualAtmosphereScalars } from "@/music-visual/types/atmosphere-scalars";
import type { MusicVisualDriveSnapshot } from "@/music-visual/types/drive";
import type { MusicVisualTuningV1 } from "@/music-visual/tuning/schema";
import { sampleTrackAnalysisAt, type TrackAudioAnalysisV1 } from "@/lib/music/track-analysis";

function clampScalar(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** rAF 内持久化的平滑状态（非 React state） */
export type MusicVisualSmooth = {
  rms: number;
  low: number;
  mid: number;
  high: number;
};

export function createMusicVisualSmoothState(): MusicVisualSmooth {
  return { rms: 0.06, low: 0, mid: 0, high: 0 };
}

/**
 * 写入与「播放视觉」相关的 CSS 变量（每帧或 tuning 变化时）。
 * `atmosphere` 来自首页氛围 → `music-visual/presets` 映射；与 WebGL 乘子一致，做轻量叠加（不改变面板原始数值语义，仅输出合成结果到 CSS）。
 */
export function applyMusicVisualTuningToElement(
  el: HTMLElement,
  tuning: MusicVisualTuningV1,
  atmosphere?: MusicVisualAtmosphereScalars | null,
): void {
  const fog = atmosphere?.fogSpeedMul ?? 1;
  const glow = atmosphere?.glowWeightMul ?? 1;
  const particle = atmosphere?.particleDensityMul ?? 1;

  const shellMul = clampScalar(0.55 + 0.45 * fog, 0.55, 1.18);
  const playMul = clampScalar(0.82 + 0.18 * particle, 0.75, 1.2);

  el.style.setProperty("--music-master", String(tuning.master));
  el.style.setProperty(
    "--music-tune-glow-mul",
    String(clampScalar(tuning.glowMul * glow, 0, 480)),
  );
  el.style.setProperty(
    "--music-tune-glow-dark-extra",
    String(clampScalar(tuning.glowDarkExtra * (0.92 + 0.08 * glow), 0.2, 280)),
  );
  el.style.setProperty(
    "--music-tune-shell-amp",
    String(clampScalar(tuning.shellBreathAmp * shellMul, 0, 30)),
  );
  el.style.setProperty(
    "--music-tune-play-mul",
    String(clampScalar(tuning.playPulseMul * playMul, 0, 2)),
  );
}

export function writeMusicVisualDriveCss(el: HTMLElement, drive: MusicVisualDriveSnapshot): void {
  el.style.setProperty("--music-rms", String(drive.rms));
  el.style.setProperty("--music-low", String(drive.low));
  el.style.setProperty("--music-mid", String(drive.mid));
  el.style.setProperty("--music-high", String(drive.high));
}

function effectiveAnalysisBlend(tuning: MusicVisualTuningV1, atmosphere?: MusicVisualAtmosphereScalars | null): number {
  const raw = !atmosphere
    ? tuning.analysisBlend
    : tuning.analysisBlend * clampScalar(0.88 + 0.12 * atmosphere.fogSpeedMul, 0.82, 1.12);
  /** 插值系数 >1 会破坏平滑；面板允许更大上限供「贴曲线」观感，引擎内封顶 */
  return Math.min(1, Math.max(0, raw));
}

function effectiveFallbackBreath(tuning: MusicVisualTuningV1, atmosphere?: MusicVisualAtmosphereScalars | null): number {
  if (!atmosphere) return clampScalar(tuning.fallbackBreath, 0, 10);
  const mul = clampScalar(0.9 + 0.1 * atmosphere.particleDensityMul, 0.85, 1.12);
  return clampScalar(tuning.fallbackBreath * mul, 0, 10);
}

/**
 * 推进一帧：预计算 JSON 查表 + 平滑，或占位呼吸；无分析时可仍在暂停态预览慢呼吸（见 fallback 分支）。
 * 会 mutates `smooth`，并把 clamp 后的通道写入 `out`（可与 `driveRef.current` 为同一对象）。
 * `atmosphere` 可选：轻微调制 `analysisBlend` / `fallbackBreath`（与首页/全屏音乐页 preset 对齐）。
 */
export function stepMusicVisualEngine(
  smooth: MusicVisualSmooth,
  analysis: TrackAudioAnalysisV1 | null,
  audio: HTMLAudioElement,
  tuning: MusicVisualTuningV1,
  nowMs: number,
  out: MusicVisualDriveSnapshot,
  atmosphere?: MusicVisualAtmosphereScalars | null,
): void {
  const blend = effectiveAnalysisBlend(tuning, atmosphere);
  const fbIn = effectiveFallbackBreath(tuning, atmosphere);

  if (analysis) {
    const raw = sampleTrackAnalysisAt(analysis, audio.currentTime);
    const gate = audio.paused ? 0.22 : 1;
    smooth.rms = smooth.rms * (1 - blend) + raw.rms * gate * blend;
    smooth.low = smooth.low * (1 - blend) + raw.low * gate * blend;
    smooth.mid = smooth.mid * (1 - blend) + raw.mid * gate * blend;
    smooth.high = smooth.high * (1 - blend) + raw.high * gate * blend;
    if (audio.paused) {
      smooth.rms *= 0.93;
      smooth.low *= 0.9;
      smooth.mid *= 0.9;
      smooth.high *= 0.9;
    }
  } else {
    const fb = fbIn;
    /** 暂停时也允许慢呼吸，便于首页未点播放时仍能预览「无数据呼吸」等滑杆（设为 0 则衰减静止） */
    const allowFallbackMotion = !audio.paused || fb >= 0.02;
    if (allowFallbackMotion && fb >= 0.02) {
      const t = nowMs * 0.001;
      const w1 = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2 * 0.35));
      const w2 = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2 * 0.19) + 0.9);
      const raw = {
        rms: (0.16 + w1 * 0.42) * fb,
        low: (0.12 + w1 * 0.38) * fb,
        mid: (0.1 + w2 * 0.34) * fb,
        high: (0.08 + (1 - w1) * w2 * 0.4) * fb,
      };
      const innerBlend = Math.min(1, 0.12 + 0.28 * fb);
      smooth.rms = smooth.rms * (1 - innerBlend) + raw.rms * innerBlend;
      smooth.low = smooth.low * (1 - innerBlend) + raw.low * innerBlend;
      smooth.mid = smooth.mid * (1 - innerBlend) + raw.mid * innerBlend;
      smooth.high = smooth.high * (1 - innerBlend) + raw.high * innerBlend;
    } else {
      smooth.rms *= 0.9;
      smooth.low *= 0.88;
      smooth.mid *= 0.88;
      smooth.high *= 0.88;
    }
  }

  out.rms = Math.min(1, Math.max(0, smooth.rms));
  out.low = Math.min(1, Math.max(0, smooth.low));
  out.mid = Math.min(1, Math.max(0, smooth.mid));
  out.high = Math.min(1, Math.max(0, smooth.high));
}
