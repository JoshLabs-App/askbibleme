import { StyleSheet } from "react-native";

export const FULL_BLEED_COVER_VIDEO_BACKDROP = "#14110e";
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
    backgroundColor: FULL_BLEED_COVER_VIDEO_BACKDROP,
  },
  slot: {
    position: "absolute",
  },
  posterCover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    backgroundColor: FULL_BLEED_COVER_VIDEO_BACKDROP,
  },
});

export type FullBleedCoverVideoLayoutMode = "portrait-cover" | "landscape-cover";
