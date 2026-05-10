const STORAGE_KEY = "selah-music-visual-tuning-v1";

/**
 * 总强度 / 光晕 / 深色光晕 / 背景呼吸：相对上一档再放约 ×10 上限（另有 CSS/WebGL 写入封顶）。
 * 「播放键」单独收窄范围，且 CSS 不与总强度相乘。
 */
export const MUSIC_VISUAL_TUNING_LIMITS = {
  master: { min: 0.25, max: 127.5 },
  glowMul: { min: 0, max: 200 },
  glowDarkExtra: { min: 0.5, max: 115 },
  shellBreathAmp: { min: 0, max: 22 },
  playPulseMul: { min: 0, max: 1.65 },
  fallbackBreath: { min: 0, max: 10 },
  analysisBlend: { min: 0.18, max: 5.58 },
} as const;

export type MusicVisualTuningV1 = {
  v: 1;
  /** 总强度，作用于光晕/缩放等（CSS --music-master）；上限见 MUSIC_VISUAL_TUNING_LIMITS */
  master: number;
  /** 底部光晕乘数 */
  glowMul: number;
  /** 深色背景时光晕相对再加成 */
  glowDarkExtra: number;
  /** 首页背景随能量缩放系数（越大越明显） */
  shellBreathAmp: number;
  /** 播放键随音频能量缩放（窄范围；不与总强度相乘） */
  playPulseMul: number;
  /** 无预计算分析时慢呼吸强度，0 关闭 */
  fallbackBreath: number;
  /** 有分析时插值跟手，越大越贴曲线（引擎内会封顶为 1） */
  analysisBlend: number;
};

export const DEFAULT_MUSIC_VISUAL_TUNING: MusicVisualTuningV1 = {
  v: 1,
  master: 1,
  glowMul: 1,
  glowDarkExtra: 1,
  shellBreathAmp: 0.09,
  playPulseMul: 1,
  fallbackBreath: 1,
  analysisBlend: 0.48,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function normalizeMusicVisualTuning(raw: unknown): MusicVisualTuningV1 {
  const d = DEFAULT_MUSIC_VISUAL_TUNING;
  const L = MUSIC_VISUAL_TUNING_LIMITS;
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Partial<MusicVisualTuningV1>;
  if (o.v !== 1) return { ...d };
  return {
    v: 1,
    master: clamp(typeof o.master === "number" ? o.master : d.master, L.master.min, L.master.max),
    glowMul: clamp(typeof o.glowMul === "number" ? o.glowMul : d.glowMul, L.glowMul.min, L.glowMul.max),
    glowDarkExtra: clamp(
      typeof o.glowDarkExtra === "number" ? o.glowDarkExtra : d.glowDarkExtra,
      L.glowDarkExtra.min,
      L.glowDarkExtra.max,
    ),
    shellBreathAmp: clamp(
      typeof o.shellBreathAmp === "number" ? o.shellBreathAmp : d.shellBreathAmp,
      L.shellBreathAmp.min,
      L.shellBreathAmp.max,
    ),
    playPulseMul: clamp(
      typeof o.playPulseMul === "number" ? o.playPulseMul : d.playPulseMul,
      L.playPulseMul.min,
      L.playPulseMul.max,
    ),
    fallbackBreath: clamp(
      typeof o.fallbackBreath === "number" ? o.fallbackBreath : d.fallbackBreath,
      L.fallbackBreath.min,
      L.fallbackBreath.max,
    ),
    analysisBlend: clamp(
      typeof o.analysisBlend === "number" ? o.analysisBlend : d.analysisBlend,
      L.analysisBlend.min,
      L.analysisBlend.max,
    ),
  };
}

export function readMusicVisualTuningFromStorage(): MusicVisualTuningV1 {
  if (typeof window === "undefined") return { ...DEFAULT_MUSIC_VISUAL_TUNING };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MUSIC_VISUAL_TUNING };
    return normalizeMusicVisualTuning(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_MUSIC_VISUAL_TUNING };
  }
}

export function writeMusicVisualTuningToStorage(t: MusicVisualTuningV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeMusicVisualTuning(t)));
  } catch {
    /* ignore */
  }
}

export { STORAGE_KEY as MUSIC_VISUAL_TUNING_STORAGE_KEY };
