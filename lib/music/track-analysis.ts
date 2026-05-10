/**
 * 预计算音轨能量曲线（上传时生成 JSON；播放时按 currentTime 查表）。
 * 此文件仅含类型与纯函数，可在浏览器与 Node 共用。
 */

export type TrackAudioAnalysisV1 = {
  v: 1;
  /** 每帧时长（秒），固定步进 */
  dt: number;
  durationSec: number;
  /** 0..1，与 dt 对齐 */
  rms: number[];
  low: number[];
  mid: number[];
  high: number[];
};

export function parseTrackAnalysisJson(raw: unknown): TrackAudioAnalysisV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<TrackAudioAnalysisV1>;
  if (o.v !== 1 || typeof o.dt !== "number" || typeof o.durationSec !== "number") return null;
  if (!Array.isArray(o.rms) || !Array.isArray(o.low) || !Array.isArray(o.mid) || !Array.isArray(o.high))
    return null;
  const n = o.rms.length;
  if (n === 0 || o.low.length !== n || o.mid.length !== n || o.high.length !== n) return null;
  if (!Number.isFinite(o.dt) || o.dt <= 0) return null;
  return {
    v: 1,
    dt: o.dt,
    durationSec: o.durationSec,
    rms: o.rms.map(clamp01),
    low: o.low.map(clamp01),
    mid: o.mid.map(clamp01),
    high: o.high.map(clamp01),
  };
}

function clamp01(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export type TrackAnalysisSample = {
  rms: number;
  low: number;
  mid: number;
  high: number;
};

const IDLE: TrackAnalysisSample = { rms: 0, low: 0, mid: 0, high: 0 };

export function sampleTrackAnalysisAt(a: TrackAudioAnalysisV1, tSec: number): TrackAnalysisSample {
  const n = a.rms.length;
  if (n === 0) return IDLE;
  const t = Math.max(0, Math.min(a.durationSec, tSec));
  const fi = t / a.dt;
  const i0 = Math.floor(fi);
  const i1 = Math.min(i0 + 1, n - 1);
  const frac = fi - i0;
  const lerp = (arr: number[]) => arr[i0] * (1 - frac) + arr[i1] * frac;
  return {
    rms: lerp(a.rms),
    low: lerp(a.low),
    mid: lerp(a.mid),
    high: lerp(a.high),
  };
}
