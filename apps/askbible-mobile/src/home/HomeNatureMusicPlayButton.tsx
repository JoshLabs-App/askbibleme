import { Pressable } from "react-native";
import { t } from "../i18n/site-copy";
import { useMusicPlaybackOptional } from "../music/MusicPlaybackContext";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "../shell/splash-branding.generated";
import { ShellMaterialIcon } from "../shell/ShellMaterialIcon";
import { SHELL_TAB_BAR_ICON } from "../shell/shellChromeIcons";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";

const HOME_MUSIC_PLAY_ICON_SIZE = 38;

/** 自然首页底部：背景音乐播放，对齐底栏 FAB 音乐行为。 */
export function HomeNatureMusicPlayButton() {
  const playback = useMusicPlaybackOptional();
  if (!playback) return null;

  const { playing, playbackMode, canTogglePlayback, togglePlayMusic } = playback;

  const musicActive = playbackMode === "music" && playing;
  const canPlay = canTogglePlayback;

  return (
    <Pressable
      onPress={() => void togglePlayMusic()}
      style={({ pressed }) => [
        styles.homeMusicPlayBtn,
        musicActive && styles.homeMusicPlayBtnActive,
        !canPlay && styles.homeMusicPlayBtnDisabled,
        pressed && canPlay ? styles.homeMusicPlayBtnPressed : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        !canPlay
          ? t("playback.noTrack")
          : musicActive
            ? t("playback.pauseMusic")
            : t("playback.playMusic")
      }
    >
      <ShellMaterialIcon
        name={musicActive ? "pause" : "play-arrow"}
        size={HOME_MUSIC_PLAY_ICON_SIZE}
        color={musicActive ? LOGO_COLOR : SHELL_TAB_BAR_ICON}
      />
    </Pressable>
  );
}
