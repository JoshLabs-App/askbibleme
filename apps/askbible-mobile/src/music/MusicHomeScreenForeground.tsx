import { View } from "react-native";
import { useLocale } from "../i18n/LocaleProvider";
import {
  PARCHMENT_COLUMN_MAX_WIDTH_PHONE,
  useParchmentColumnMaxWidth,
  useReadPagePaddingHorizontal,
} from "../read/parchmentColumnLayout";
import { MusicHomeForegroundPanel } from "./MusicHomeForegroundPanel";
import { MusicHomeSleepTimerButton } from "./MusicHomeSleepTimerButton";
import { musicHomeScreenStyles as styles } from "./musicHomeScreenStyles";
import { MusicHomeStageTapSurface } from "./MusicHomeStageTapSurface";
import { MusicHomeUpperDecor } from "./MusicHomeUpperDecor";
import type { MusicHomeScreenController } from "./useMusicHomeScreenController";

type Props = Pick<
  MusicHomeScreenController,
  "layoutState" | "playback" | "upper" | "sleepTimer" | "albumState" | "uiAutoHide" | "gestures" | "queue"
> & {
  albumDecorVisible: boolean;
  albumDecorMotionActive: boolean;
  analysisSrc: string | null;
  duration: number;
  musicActive: boolean;
  playbackMode: string;
};

export function MusicHomeScreenForeground({
  layoutState,
  playback,
  upper,
  sleepTimer,
  albumState,
  uiAutoHide,
  gestures,
  queue,
  albumDecorVisible,
  albumDecorMotionActive,
  analysisSrc,
  duration,
  musicActive,
  playbackMode,
}: Props) {
  const { locale } = useLocale();
  const { insets, compactLandscape, contentBottomPad, viewportHeight, viewportTop, landscapeSafeHorizontal } =
    layoutState;
  const { chromeVisible, resetUiAutoHide } = uiAutoHide;
  const { album } = albumState;
  const padX = useReadPagePaddingHorizontal();
  const columnMaxWidth = useParchmentColumnMaxWidth(PARCHMENT_COLUMN_MAX_WIDTH_PHONE);

  return (
    <View
      style={[
        styles.foreground,
        compactLandscape && styles.foregroundLandscape,
        { paddingTop: insets.top + 8, paddingBottom: contentBottomPad },
      ]}
      pointerEvents="box-none"
    >
      <MusicHomeStageTapSurface
        compactLandscape={compactLandscape}
        playing={playback.playing}
        canTogglePlayback={playback.canTogglePlayback}
        hasTracks={playback.tracks.length > 0}
        onTogglePlay={() => void playback.togglePlayMusic()}
      >
        <MusicHomeUpperDecor
          album={album}
          upperSize={upper.upperSize}
          compactLandscape={compactLandscape}
          viewportHeight={viewportHeight}
          viewportTop={viewportTop}
          albumDecorVisible={albumDecorVisible}
          albumDecorMotionActive={albumDecorMotionActive}
          analysisSrc={analysisSrc}
          onUpperLayout={upper.onUpperLayout}
          landscapeSafeHorizontal={landscapeSafeHorizontal}
        />
      </MusicHomeStageTapSurface>

      <MusicHomeSleepTimerButton
        chromeVisible={chromeVisible}
        sleepTimerMinutes={playback.sleepTimerMinutes}
        sleepTimerBadge={sleepTimer.sleepTimerBadge}
        onCycleSleepTimer={sleepTimer.cycleSleepTimer}
      />

      <View
        style={[
          styles.panel,
          compactLandscape && styles.panelLandscape,
          !compactLandscape && {
            paddingHorizontal: padX,
            ...(columnMaxWidth != null ? { maxWidth: columnMaxWidth } : null),
          },
        ]}
        onTouchStart={compactLandscape ? resetUiAutoHide : undefined}
        pointerEvents="box-none"
      >
        <MusicHomeForegroundPanel
          locale={locale}
          compactLandscape={compactLandscape}
          chromeVisible={chromeVisible}
          playback={playback}
          albumState={albumState}
          gestures={gestures}
          queue={queue}
          duration={duration}
          musicActive={musicActive}
          playbackMode={playbackMode}
        />
      </View>
    </View>
  );
}
