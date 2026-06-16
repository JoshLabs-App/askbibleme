import { coverMediaRectLeft } from "./coverMediaRect";
import { NATURE_HOME_VIDEO_LANDSCAPE_ASPECT } from "./nature-home-portrait-pan";

export type PortraitCoverLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** 竖屏首页 cover 层几何（贴左裁切、静止显示，与 Web object-position: left center 一致） */
export function resolveNatureHomePortraitCoverLayout(
  viewportWidth: number,
  viewportHeight: number,
  mediaAspect = NATURE_HOME_VIDEO_LANDSCAPE_ASPECT,
): PortraitCoverLayout {
  const rect = coverMediaRectLeft(
    { w: viewportWidth, h: viewportHeight },
    { w: mediaAspect * 1000, h: 1000 },
  );
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * @deprecated 竖屏已改为宽容器 + translateX 贴左平移（与 iOS 同构）；保留供旧实验引用。
 */
export const ANDROID_NATIVE_LEFT_CENTER_CROP = "15";
