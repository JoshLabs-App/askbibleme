import type { TrackAudioAnalysisV1 } from "./trackAnalysisTypes";
import { sampleTrackAnalysisAt } from "./trackAnalysisCore";

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

export function shapeSpectrumLevel(raw: number): number {
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

