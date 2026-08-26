import { Image, StyleSheet, View } from "react-native";
import { shellFullBleedBackdropStyle } from "../shell/shellLayout";
import { MusicEnergyGlow } from "./MusicEnergyGlow";
import { SlowMeteors, SlowStars, WorkSpacePlanets } from "./MusicHomeAlbumVisuals";
import type { PlaybackTrack } from "./types";

type Frame = { width: number; height: number };

type Props = {
  current: PlaybackTrack;
  album: string;
  inTab: boolean;
  fullBleedFrame: Frame;
  windowW: number;
  windowH: number;
  glowColors: readonly [string, string, string];
  albumDecorVisible: boolean;
  albumDecorMotionActive: boolean;
  showArtwork?: boolean;
};

export function MusicHomeBackdrop({
  current,
  album,
  inTab,
  fullBleedFrame,
  windowW,
  windowH,
  glowColors,
  albumDecorVisible,
  albumDecorMotionActive,
  showArtwork = false,
}: Props) {
  const width = inTab ? fullBleedFrame.width : windowW;
  const height = inTab ? fullBleedFrame.height : windowH;

  return (
    <View pointerEvents="none" style={inTab ? shellFullBleedBackdropStyle(fullBleedFrame) : styles.backdrop}>
      {showArtwork ? (
        <Image
          source={current.artworkUri ? { uri: current.artworkUri } : undefined}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <>
          <MusicEnergyGlow
            width={width}
            height={height}
            colors={glowColors}
            breathing={albumDecorMotionActive}
            flatGradientOnly={album === "睡眠"}
            showBottomScrim={!inTab}
            showCenterOrb={album !== "安静" && album !== "睡眠" && album !== "专注工作"}
            centerOrbSway={album === "下午茶"}
            showSideOrbs={album !== "安静" && album !== "专注工作"}
          />
          {album === "专注工作" ? (
            <WorkSpacePlanets visible={albumDecorVisible} active={albumDecorMotionActive} width={width} height={height} />
          ) : null}
          {album === "睡眠" ? (
            <SlowStars visible={albumDecorVisible} active={albumDecorMotionActive} width={width} height={height} />
          ) : null}
          {album === "睡眠" ? (
            <SlowMeteors visible={albumDecorVisible} active={albumDecorMotionActive} width={width} height={height} />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
});
