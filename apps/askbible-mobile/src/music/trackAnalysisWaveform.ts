import type { TrackAudioAnalysisV1 } from "./trackAnalysisTypes";
import { sampleTrackAnalysisAt } from "./trackAnalysisCore";
import { MUSIC_SCROLL_CURVE, MUSIC_SPECTRUM_VISUAL, shapeSpectrumLevel } from "./trackAnalysisSpectrum";

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

