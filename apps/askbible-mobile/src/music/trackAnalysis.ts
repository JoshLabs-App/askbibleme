/** 与 `lib/music/track-analysis.ts` 同构：预计算能量曲线查表 */

export type TrackAudioAnalysisV1 = {
  v: 1;
  dt: number;
  durationSec: number;
  rms: number[];
  low: number[];
  mid: number[];
  high: number[];
};

export type TrackAnalysisSample = {
  rms: number;
  low: number;
  mid: number;
  high: number;
};

const IDLE: TrackAnalysisSample = { rms: 0, low: 0, mid: 0, high: 0 };

function clamp01(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

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

export function sampleTrackAnalysisAt(a: TrackAudioAnalysisV1, tSec: number): TrackAnalysisSample {
  const n = a.rms.length;
  if (n === 0) return IDLE;
  const t = Math.max(0, Math.min(a.durationSec, tSec));
  const fi = t / a.dt;
  const i0 = Math.floor(fi);
  const i1 = Math.min(i0 + 1, n - 1);
  const frac = fi - i0;
  const lerp = (arr: number[]) => arr[i0]! * (1 - frac) + arr[i1]! * frac;
  return {
    rms: lerp(a.rms),
    low: lerp(a.low),
    mid: lerp(a.mid),
    high: lerp(a.high),
  };
}

/** `/music/uploads/<id>.m4a` → `/music/analysis/<id>.json` */
export function analysisSrcFromAudioPath(src: string): string | null {
  const m = src.match(/\/music\/uploads\/([^/?#]+)\.[a-z0-9]+$/i);
  if (!m?.[1]) return null;
  return `/music/analysis/${m[1]}.json`;
}

export function downsampleRmsForWaveform(rms: number[], pointCount: number): number[] {
  const n = Math.max(2, Math.floor(pointCount));
  if (rms.length === 0) return Array(n).fill(0.06);
  if (rms.length <= n) return [...rms];
  const out: number[] = [];
  const bucket = rms.length / n;
  for (let i = 0; i < n; i++) {
    const start = Math.floor(i * bucket);
    const end = Math.max(start + 1, Math.floor((i + 1) * bucket));
    let peak = 0;
    for (let j = start; j < end && j < rms.length; j++) peak = Math.max(peak, rms[j] ?? 0);
    out.push(peak);
  }
  return out;
}

export function normalizeWaveformSamples(samples: number[]): number[] {
  if (samples.length === 0) return [];
  let max = 0;
  for (const v of samples) max = Math.max(max, v);
  const denom = Math.max(max, 0.001);
  return samples.map((v) => 0.07 + (v / denom) * 0.93);
}

export const MUSIC_SPECTRUM_VISUAL = {
  lerpPlaying: 0.1,
  lerpIdle: 0.05,
  levelGain: 1.32,
  levelMin: 0.04,
  levelBase: 0.05,
  levelScale: 1.08,
  curveAmpRatio: 0.97,
  idleTimeScale: 0.42,
  idleWobbleGain: 1.4,
} as const;

export const MUSIC_SCROLL_CURVE = {
  historyLen: 96,
  msPerStepPlaying: 54,
  msPerStepIdle: 92,
  ampRatio: 0.44,
  pointGain: 1.15,
} as const;

function shapeSpectrumLevel(raw: number): number {
  const lifted = MUSIC_SPECTRUM_VISUAL.levelBase + raw * MUSIC_SPECTRUM_VISUAL.levelScale;
  return Math.min(1, Math.max(MUSIC_SPECTRUM_VISUAL.levelMin, lifted * MUSIC_SPECTRUM_VISUAL.levelGain));
}

export function sampleSpectrumBarLevels(
  analysis: TrackAudioAnalysisV1 | null,
  tSec: number,
  barCount: number,
  playing: boolean,
): number[] {
  const n = Math.max(4, Math.floor(barCount));
  if (!analysis || !playing) return idleSpectrumBarLevels(n, tSec);
  const center = sampleTrackAnalysisAt(analysis, tSec);
  return Array.from({ length: n }, (_, i) => {
    const phase = i / Math.max(1, n - 1);
    const lowW = Math.max(0, 1.1 - phase * 2.4);
    const midW = Math.max(0, 1 - Math.abs(phase - 0.42) * 2.6);
    const highW = Math.max(0, (phase - 0.32) * 1.55);
    const wSum = lowW + midW + highW + 1e-6;
    const band = (center.low * lowW + center.mid * midW + center.high * highW) / wSum;
    const spread = ((i * 0.37) % 1) - 0.5;
    const tOff = spread * analysis.dt * 2.5;
    const near = sampleTrackAnalysisAt(
      analysis,
      Math.max(0, Math.min(analysis.durationSec, tSec + tOff)),
    );
    const level = band * 0.58 + near.rms * 0.28 + center.rms * 0.14;
    return shapeSpectrumLevel(level);
  });
}

export function resolvePlaybackDisplaySec(
  currentSec: number,
  durationSec: number,
  playing: boolean,
  sync: { sec: number; at: number },
  now: number,
): number {
  if (playing && durationSec > 0) {
    const elapsed = (now - sync.at) / 1000;
    return Math.min(durationSec, sync.sec + elapsed);
  }
  return now / 1000;
}

export function createScrollingHistory(maxLen: number, fill = 0.5): number[] {
  return Array.from({ length: maxLen }, () => fill);
}

export function sampleScrollingCurvePoint(
  analysis: TrackAudioAnalysisV1 | null,
  tSec: number,
  playing: boolean,
): number {
  if (analysis && playing) {
    const s = sampleTrackAnalysisAt(analysis, tSec);
    const raw = s.rms * 0.62 + s.mid * 0.24 + s.low * 0.14;
    const shaped = shapeSpectrumLevel(raw);
    const centered = 0.5 + (shaped - 0.5) * MUSIC_SCROLL_CURVE.pointGain;
    return Math.min(1, Math.max(0, centered));
  }
  const ts = tSec * MUSIC_SPECTRUM_VISUAL.idleTimeScale;
  const wobble = Math.sin(ts * 1.6) * 0.12 + Math.sin(ts * 0.85 + 1.1) * 0.08;
  return Math.min(1, Math.max(0, 0.5 + wobble));
}

export function pushScrollingHistory(history: number[], point: number, maxLen: number): number[] {
  const next = [Math.min(1, Math.max(0, point)), ...history];
  return next.slice(0, maxLen);
}

export function buildScrollingWaveSvgPath(history: number[], width: number, height: number): string {
  const n = history.length;
  if (n < 2) return "";
  const mid = height * 0.5;
  const amp = height * MUSIC_SCROLL_CURVE.ampRatio;
  const step = width / (n - 1);
  const yAt = (i: number) => mid - ((history[i] ?? 0.5) - 0.5) * amp * 2;

  let d = `M 0 ${yAt(0).toFixed(2)}`;
  for (let i = 1; i < n; i++) {
    const x1 = i * step;
    const cx = ((i - 0.5) * step).toFixed(2);
    d += ` Q ${cx} ${yAt(i).toFixed(2)} ${x1.toFixed(2)} ${yAt(i).toFixed(2)}`;
  }
  return d;
}

export function buildSpectrumCurveSvgPath(levels: number[], width: number, height: number): string {
  const n = levels.length;
  if (n < 2) return "";
  const base = height - 2;
  const amp = (height - 6) * MUSIC_SPECTRUM_VISUAL.curveAmpRatio;
  const step = width / (n - 1);
  const yAt = (i: number) => base - (levels[i] ?? 0) * amp;

  let d = `M 0 ${yAt(0).toFixed(2)}`;
  for (let i = 1; i < n; i++) {
    const x1 = i * step;
    const cx = ((i - 0.5) * step).toFixed(2);
    d += ` Q ${cx} ${yAt(i).toFixed(2)} ${x1.toFixed(2)} ${yAt(i).toFixed(2)}`;
  }
  return d;
}

export function idleSpectrumBarLevels(barCount: number, tSec: number): number[] {
  const n = Math.max(4, Math.floor(barCount));
  const ts = tSec * MUSIC_SPECTRUM_VISUAL.idleTimeScale;
  const wGain = MUSIC_SPECTRUM_VISUAL.idleWobbleGain;
  return Array.from({ length: n }, (_, i) => {
    const phase = i / Math.max(1, n - 1);
    const wobble =
      (Math.sin(ts * 2.4 + phase * 9.5) * 0.045 +
        Math.sin(ts * 1.35 + phase * 4.2 + 0.6) * 0.035) *
      wGain;
    return shapeSpectrumLevel(0.1 + wobble);
  });
}

export function idleWaveformSamples(pointCount: number): number[] {
  const n = Math.max(2, Math.floor(pointCount));
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return (
      0.08 +
      Math.sin(t * Math.PI * 3.2) * 0.05 +
      Math.sin(t * Math.PI * 8.5 + 0.4) * 0.03
    );
  });
}
