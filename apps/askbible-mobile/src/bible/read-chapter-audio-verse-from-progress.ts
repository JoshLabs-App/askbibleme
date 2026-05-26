const MIN_WEIGHT = 10;

export function verseWeightsForReadChapterAudio(verses: readonly { text: string }[]): number[] {
  return verses.map((v) => {
    const n = Array.from(v.text.trim()).length;
    return Math.max(MIN_WEIGHT, n);
  });
}

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

export function verseIndexForReadChapterAudioTime(
  currentSec: number,
  durationSec: number,
  weights: readonly number[],
): number | null {
  if (weights.length === 0) return null;
  if (!Number.isFinite(currentSec) || !Number.isFinite(durationSec) || durationSec <= 0.05) return null;
  return verseIndexForReadChapterAudioRatio(currentSec / durationSec, weights);
}
