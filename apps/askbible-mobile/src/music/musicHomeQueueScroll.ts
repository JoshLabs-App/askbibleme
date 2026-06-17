export const MUSIC_HOME_QUEUE_ROW_HEIGHT = 40;
export const MUSIC_HOME_QUEUE_VIEWPORT_HEIGHT = 168;
export const MUSIC_HOME_QUEUE_FADE_BAND = 46;

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function musicHomeQueueRowOpacity(
  rowIndex: number,
  scrollY: number,
  active: boolean,
): number {
  const rowCenter = rowIndex * MUSIC_HOME_QUEUE_ROW_HEIGHT + MUSIC_HOME_QUEUE_ROW_HEIGHT / 2 - scrollY;
  if (rowCenter <= 0 || rowCenter >= MUSIC_HOME_QUEUE_VIEWPORT_HEIGHT) return 0;
  const topFade = clamp01(rowCenter / MUSIC_HOME_QUEUE_FADE_BAND);
  const bottomFade = clamp01((MUSIC_HOME_QUEUE_VIEWPORT_HEIGHT - rowCenter) / MUSIC_HOME_QUEUE_FADE_BAND);
  const edgeFade = Math.min(topFade, bottomFade);
  const base = Math.pow(edgeFade, 1.05);
  if (active) return Math.min(1, base * 0.96 + 0.04);
  return Math.max(0, base * 0.92);
}

export function musicHomeQueueRowScale(
  rowIndex: number,
  scrollY: number,
  active: boolean,
): number {
  const rowCenter = rowIndex * MUSIC_HOME_QUEUE_ROW_HEIGHT + MUSIC_HOME_QUEUE_ROW_HEIGHT / 2 - scrollY;
  const center = MUSIC_HOME_QUEUE_VIEWPORT_HEIGHT / 2;
  const nearCenter = 1 - clamp01(Math.abs(rowCenter - center) / Math.max(1, center * 0.85));
  const base = 1 + nearCenter * 0.08;
  if (active) return Math.max(base, 1.14);
  return base;
}
