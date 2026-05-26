/** 靠边时只挪动下方标签，圆点仍按真实进度 */
export function clampTimelineLabelProgress(progress: number): number {
  return Math.min(0.88, Math.max(0.12, progress));
}

export const EXPLORE_TIMELINE_EDGE_W = 40;
export const EXPLORE_TIMELINE_LABEL_W = 96;
