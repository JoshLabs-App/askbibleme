export const ALBUM_BTN_WIDTH = 56;
export const ALBUM_BTN_GAP = 12;
export const ALBUM_STRIP_FADE = 16;

export function albumStripContentWidth(count: number): number {
  if (count <= 0) return 0;
  return count * ALBUM_BTN_WIDTH + Math.max(0, count - 1) * ALBUM_BTN_GAP;
}

/** 将第 index 个分类滚入视口中央（与首页场景条同一套算法）。 */
export function albumStripScrollX(index: number, viewportWidth: number, count: number): number {
  if (count <= 0 || viewportWidth < 1 || index < 0) return 0;
  const contentW = albumStripContentWidth(count);
  const x = index * (ALBUM_BTN_WIDTH + ALBUM_BTN_GAP);
  const maxScroll = Math.max(0, contentW - viewportWidth);
  const centered = x - (viewportWidth - ALBUM_BTN_WIDTH) / 2;
  return Math.max(0, Math.min(maxScroll, centered));
}
