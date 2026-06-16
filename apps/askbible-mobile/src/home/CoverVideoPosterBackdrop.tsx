import { Image, ImageSourcePropType, StyleSheet, View } from "react-native";
import type { PortraitCoverLayout } from "./natureHomePortraitCoverLayout";

const STAGE_BACKDROP = "#14110e";

type Props = {
  posterModule?: number | null;
  posterUri?: string;
  portraitLayout?: PortraitCoverLayout | null;
  viewportWidth?: number;
  viewportHeight?: number;
};

function posterSource(posterModule?: number | null, posterUri?: string): ImageSourcePropType | null {
  if (posterModule != null) return posterModule;
  const uri = posterUri?.trim() ?? "";
  return uri ? { uri } : null;
}

/** 首页场景静帧背景：优先 APK 内 `require()`，其次 URI。 */
export function CoverVideoPosterBackdrop({
  posterModule,
  posterUri,
  portraitLayout,
  viewportWidth,
  viewportHeight,
}: Props) {
  const source = posterSource(posterModule, posterUri);
  if (source == null) return null;

  if (portraitLayout && viewportWidth != null && viewportHeight != null) {
    return (
      <View
        style={[styles.clipViewport, styles.posterCover, { width: viewportWidth, height: viewportHeight }]}
        pointerEvents="none"
      >
        <Image
          source={source}
          style={{
            position: "absolute",
            left: portraitLayout.left,
            top: portraitLayout.top,
            width: portraitLayout.width,
            height: portraitLayout.height,
          }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={styles.posterCover} pointerEvents="none">
      <Image source={source} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  clipViewport: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
  },
  posterCover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    backgroundColor: STAGE_BACKDROP,
  },
});
