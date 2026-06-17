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
