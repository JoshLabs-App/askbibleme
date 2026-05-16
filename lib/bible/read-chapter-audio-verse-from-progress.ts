/**
 * 整章朗读 MP3 无逐节时间码时：按经文长度比例把播放进度映射到节号（估算）。
 * 短节设最小权重，避免被「挤没」。
 */
const MIN_WEIGHT = 10;

export function verseWeightsForReadChapterAudio(verses: readonly { text: string }[]): number[] {
  return verses.map((v) => {
    const n = Array.from(v.text.trim()).length;
    return Math.max(MIN_WEIGHT, n);
  });
}

/** @returns 0-based index into `verses` / `weights` */
export function verseIndexForReadChapterAudioRatio(ratio: number, weights: readonly number[]): number {
  if (weights.length === 0) return 0;
  const r = Math.min(1, Math.max(0, ratio));
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return 0;
  const x = r * total;
  let cum = 0;
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i]!;
    if (x < cum) return i;
  }
  return weights.length - 1;
}

/** 可选：整章 MP3 的片头/片尾不参与「经文朗读进度」比例（见 `cuv-chapter-audio-content-bounds`） */
export type VerseAudioContentBounds = {
  /** 正文开读之前的秒数；此区间内返回 null（不高亮） */
  contentStartSec?: number;
  /** 从总时长末尾向内扣除的秒数（尾声等） */
  contentEndTrimSec?: number;
};

export function verseIndexForReadChapterAudioTime(
  currentSec: number,
  durationSec: number,
  weights: readonly number[],
  bounds?: VerseAudioContentBounds,
): number | null {
  if (weights.length === 0) return null;
  if (!Number.isFinite(currentSec) || !Number.isFinite(durationSec) || durationSec <= 0.05) return null;

  const start = Math.max(0, bounds?.contentStartSec ?? 0);
  const endTrim = Math.max(0, bounds?.contentEndTrimSec ?? 0);
  const span = durationSec - start - endTrim;

  if (start <= 0 && endTrim <= 0) {
    return verseIndexForReadChapterAudioRatio(currentSec / durationSec, weights);
  }

  if (currentSec < start) return null;
  if (span <= 0.05) {
    return verseIndexForReadChapterAudioRatio(currentSec / durationSec, weights);
  }

  const t = Math.min(Math.max(0, currentSec - start), span);
  return verseIndexForReadChapterAudioRatio(t / span, weights);
}
