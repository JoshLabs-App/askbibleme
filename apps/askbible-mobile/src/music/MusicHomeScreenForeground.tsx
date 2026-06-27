import { View } from "react-native";
import { useLocale } from "../i18n/LocaleProvider";
import { MusicHomeForegroundPanel } from "./MusicHomeForegroundPanel";
import { musicHomeScreenStyles as styles } from "./musicHomeScreenStyles";
import { MusicHomeStageTapSurface } from "./MusicHomeStageTapSurface";
import { MusicHomeUpperDecor } from "./MusicHomeUpperDecor";
import type { MusicHomeScreenController } from "./useMusicHomeScreenController";

type Props = Pick<
  MusicHomeScreenController,
  "layoutState" | "playback" | "seek" | "upper" | "sleepTimer" | "albumState" | "uiAutoHide" | "gestures" | "queue"
> & {
  albumDecorVisible: boolean;
  albumDecorMotionActive: boolean;
  coffeeRhythmPulse: number;
  duration: number;
  position: number;
  progress: number;
};

export function MusicHomeScreenForeground({
  layoutState,
  playback,
  seek,
  upper,
  sleepTimer,
  albumState,
  uiAutoHide,
  gestures,
  queue,
  albumDecorVisible,
  albumDecorMotionActive,
  coffeeRhythmPulse,
  duration,
  position,
  progress,
}: Props) {
  const { locale } = useLocale();
  const { insets, compactLandscape, contentBottomPad, viewportHeight, viewportTop, landscapeSafeHorizontal } =
    layoutState;
  const { chromeVisible, resetUiAutoHide } = uiAutoHide;
  const { album } = albumState;

  return (
    <View
      style={[
        styles.foreground,
        compactLandscape && styles.foregroundLandscape,
        { paddingTop: insets.top + 8, paddingBottom: contentBottomPad },
      ]}
      pointerEvents={compactLandscape ? "box-none" : "auto"}
    >
      <MusicHomeStageTapSurface compactLandscape={compactLandscape}>
        <MusicHomeUpperDecor
          album={album}
          upperSize={upper.upperSize}
          compactLandscape={compactLandscape}
          viewportHeight={viewportHeight}
          viewportTop={viewportTop}
          albumDecorVisible={albumDecorVisible}
          albumDecorMotionActive={albumDecorMotionActive}
          coffeeRhythmPulse={coffeeRhythmPulse}
          onUpperLayout={upper.onUpperLayout}
          landscapeSafeHorizontal={landscapeSafeHorizontal}
        />
      </MusicHomeStageTapSurface>

      <View
        style={[styles.panel, compactLandscape && styles.panelLandscape]}
        onTouchStart={compactLandscape ? resetUiAutoHide : undefined}
      >
        <MusicHomeForegroundPanel
          locale={locale}
          compactLandscape={compactLandscape}
          chromeVisible={chromeVisible}
          playback={playback}
          seek={seek}
          sleepTimer={sleepTimer}
          albumState={albumState}
          gestures={gestures}
          queue={queue}
          duration={duration}
          position={position}
          progress={progress}
        />
      </View>
    </View>
  );
}
