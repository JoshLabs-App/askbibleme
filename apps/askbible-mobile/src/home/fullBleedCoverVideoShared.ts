import { StyleSheet } from "react-native";

/** 透明：视频↔静帧切换时勿露白底造成跳闪 */
export const FULL_BLEED_COVER_VIDEO_BACKDROP = "transparent";
/** 封面未就绪时的底色；勿用白，否则卸视频后会整页白屏 */
export const FULL_BLEED_COVER_FALLBACK_BG = "#0a0806";
export const FULL_BLEED_VIDEO_OVERDRAW_PX = 2;
export const FULLSCREEN_VIDEO_ASPECT = 16 / 9;

export type CoverLayerFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function resolveLandscapeCoverLayerFrame(
  viewportWidth: number,
  viewportHeight: number,
): CoverLayerFrame {
  const width = Math.max(viewportWidth, Math.round(viewportHeight * FULLSCREEN_VIDEO_ASPECT));
  return {
    left: (viewportWidth - width) / 2,
    top: 0,
    width,
    height: viewportHeight,
  };
}

export const fullBleedCoverVideoStyles = StyleSheet.create({
  stage: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  slot: {
    position: "absolute",
  },
  posterCover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
  },
});

export type FullBleedCoverVideoLayoutMode = "portrait-cover" | "landscape-cover";
