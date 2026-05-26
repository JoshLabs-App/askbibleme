type Size = { w: number; h: number };

/** 与网站竖屏 `object-position: 0% center` 一致：cover 后水平贴左、垂直居中 */
export function coverMediaRectLeft(container: Size, media: Size): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const { w: cw, h: ch } = container;
  const mw = media.w > 0 ? media.w : 16;
  const mh = media.h > 0 ? media.h : 9;
  const mediaAR = mw / mh;
  const containerAR = cw / ch;

  if (mediaAR > containerAR) {
    const height = ch;
    const width = ch * mediaAR;
    return { left: 0, top: 0, width, height };
  }

  const width = cw;
  const height = cw / mediaAR;
  return { left: 0, top: (ch - height) / 2, width, height };
}

/** 竖屏 cover 贴左时，横向可平移量（≤0）；无溢出时为 0 */
export function coverMediaPortraitPanRange(container: Size, media: Size): number {
  const rect = coverMediaRectLeft(container, media);
  return Math.min(0, container.w - rect.width);
}

/**
 * 横屏沉浸：满屏 cover、居中裁切（无黑边）。
 * 视频更宽时高度撑满、左右裁；更窄时宽度撑满、上下裁。
 */
export function coverMediaRectCoverCenter(container: Size, media: Size): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const { w: cw, h: ch } = container;
  const mw = media.w > 0 ? media.w : 16;
  const mh = media.h > 0 ? media.h : 9;
  const mediaAR = mw / mh;
  const containerAR = cw / ch;

  if (mediaAR > containerAR) {
    const height = ch;
    const width = ch * mediaAR;
    return { left: (cw - width) / 2, top: 0, width, height };
  }

  const width = cw;
  const height = cw / mediaAR;
  return { left: 0, top: (ch - height) / 2, width, height };
}
