import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocale } from "../i18n/LocaleProvider";
import { musicCopy } from "./musicCopy";
import { musicHomeScreenStyles as styles } from "./musicHomeScreenStyles";
import { MusicHomeBackdrop } from "./MusicHomeBackdrop";
import { MusicHomeLandscapeChrome } from "./MusicHomeLandscapeChrome";
import { MusicHomeScreenForeground } from "./MusicHomeScreenForeground";
import type { MusicHomeScreenController } from "./useMusicHomeScreenController";

type Props = MusicHomeScreenController;

export function MusicHomeScreenView(props: Props) {
  const router = useRouter();
  const { locale } = useLocale();
  const {
    layoutState,
    playback,
    upper,
    sleepTimer,
    albumState,
    glowColors,
    current,
    albumDecorVisible,
    albumDecorMotionActive,
    duration,
    musicActive,
    playbackMode,
    analysisSrc,
    uiAutoHide,
    gestures,
    queue,
  } = props;
  const {
    insets,
    windowW,
    windowH,
    fullBleedFrame,
    inTab,
    compactLandscape,
    landscapeSafeHorizontal,
  } = layoutState;
  const { chromeVisible, nowClockText, resetUiAutoHide, onLandscapeStageToggle } = uiAutoHide;
  const { album } = albumState;
  const { tracks, loading } = playback;

  return (
    <View style={styles.root} onTouchStart={compactLandscape ? undefined : resetUiAutoHide}>
      <StatusBar style="light" />

      {!loading && current ? (
        <MusicHomeBackdrop
          current={current}
          album={album}
          inTab={inTab}
          fullBleedFrame={fullBleedFrame}
          windowW={windowW}
          windowH={windowH}
          glowColors={glowColors}
          albumDecorVisible={albumDecorVisible}
          albumDecorMotionActive={albumDecorMotionActive}
        />
      ) : null}

      <MusicHomeLandscapeChrome
        locale={locale}
        album={album}
        compactLandscape={compactLandscape}
        chromeVisible={chromeVisible}
        loading={loading}
        hasCurrent={Boolean(current)}
        nowClockText={nowClockText}
        landscapeSafeHorizontal={landscapeSafeHorizontal}
        bottomInset={insets.bottom}
        playing={playback.playing}
        canTogglePlayback={playback.canTogglePlayback}
        onLandscapeStageToggle={onLandscapeStageToggle}
        onTogglePlay={() => void playback.togglePlayMusic()}
      />

      {chromeVisible && !inTab && router.canGoBack() ? (
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { top: insets.top + 2 }, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <MaterialIcons name="keyboard-arrow-down" size={26} color="rgba(255,255,255,0.72)" />
        </Pressable>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="rgba(255,255,255,0.45)" />
        </View>
      ) : tracks.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{musicCopy.noAudio}</Text>
        </View>
      ) : current ? (
        <MusicHomeScreenForeground
          layoutState={layoutState}
          playback={playback}
          upper={upper}
          sleepTimer={sleepTimer}
          albumState={albumState}
          uiAutoHide={uiAutoHide}
          gestures={gestures}
          queue={queue}
          albumDecorVisible={albumDecorVisible}
          albumDecorMotionActive={albumDecorMotionActive}
          analysisSrc={analysisSrc}
          duration={duration}
          musicActive={musicActive}
          playbackMode={playbackMode}
        />
      ) : null}
    </View>
  );
}
