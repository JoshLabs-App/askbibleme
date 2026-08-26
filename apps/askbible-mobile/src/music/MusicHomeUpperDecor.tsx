import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import {
  BreathingRing,
  CoffeeBeanOrbit,
  SleepCrescentMoon,
  SlowFish,
  SunOrb,
} from "./MusicHomeAlbumVisuals";

type Size = { width: number; height: number };

type Props = {
  album: string;
  upperSize: Size;
  compactLandscape: boolean;
  viewportHeight: number;
  viewportTop: number;
  albumDecorVisible: boolean;
  albumDecorMotionActive: boolean;
  analysisSrc: string | null;
  onUpperLayout: (event: LayoutChangeEvent) => void;
  landscapeSafeHorizontal: { left: number; right: number } | null;
};

export function MusicHomeUpperDecor({
  album,
  upperSize,
  compactLandscape,
  viewportHeight,
  viewportTop,
  albumDecorVisible,
  albumDecorMotionActive,
  analysisSrc,
  onUpperLayout,
  landscapeSafeHorizontal,
}: Props) {
  return (
    <View
      style={[styles.upper, compactLandscape && styles.upperLandscape, compactLandscape && landscapeSafeHorizontal]}
      onLayout={onUpperLayout}
    >
      {album === "安静" && upperSize.width > 0 && upperSize.height > 0 ? (
        <SlowFish
          active={albumDecorMotionActive}
          width={upperSize.width}
          height={upperSize.height}
          viewportHeight={viewportHeight}
          viewportTop={viewportTop}
          centerMode={compactLandscape ? "center" : "lower"}
        />
      ) : null}
      {album === "下午茶" && upperSize.width > 0 && upperSize.height > 0 ? (
        <CoffeeBeanOrbit
          visible={albumDecorVisible}
          active={albumDecorMotionActive}
          width={upperSize.width}
          height={upperSize.height}
          viewportHeight={viewportHeight}
          viewportTop={viewportTop}
          centered={compactLandscape}
          analysisSrc={analysisSrc}
        />
      ) : null}
      {album === "安静" ? (
        <BreathingRing
          visible={albumDecorVisible}
          active={albumDecorMotionActive}
          centered={compactLandscape}
          containerHeight={upperSize.height}
          viewportHeight={viewportHeight}
          viewportTop={viewportTop}
        />
      ) : null}
      {album === "下午茶" ? (
        <SunOrb
          visible={albumDecorVisible}
          active={albumDecorMotionActive}
          centered={compactLandscape}
          containerHeight={upperSize.height}
          viewportHeight={viewportHeight}
          viewportTop={viewportTop}
        />
      ) : null}
      {album === "睡眠" ? (
        <SleepCrescentMoon visible={albumDecorVisible} active={albumDecorMotionActive} centered={compactLandscape} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  upper: {
    flex: 1,
    minHeight: 80,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "visible",
  },
  upperLandscape: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    justifyContent: "center",
    minHeight: 0,
    paddingBottom: 0,
  },
});
