import { Pressable } from "react-native";
import { t } from "../i18n/site-copy";
import { useMusicPlaybackOptional } from "../music/MusicPlaybackContext";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";

type Props = {
  autoImmersive: boolean;
  enabled: boolean;
  onInteraction: () => void;
};

/** 场景首页背景点按：音乐播放/暂停。经文正文由 HomeVerseOverlay 单独处理。 */
export function HomeNatureScreenInteractionLayer({
  autoImmersive,
  enabled,
  onInteraction,
}: Props) {
  const playback = useMusicPlaybackOptional();

  if (!enabled) return null;

  if (autoImmersive) {
    return (
      <Pressable
        style={styles.autoImmersiveBackdrop}
        onPress={onInteraction}
        accessibilityRole="button"
        accessibilityLabel={t("nature.homeBackdropTapAria")}
      />
    );
  }

  if (!playback) return null;

  const { playing, playbackMode, canTogglePlayback, togglePlayMusic } = playback;
  const musicActive = playbackMode === "music" && playing;

  return (
    <Pressable
      style={styles.sceneMusicTapSurface}
      onPress={() => {
        onInteraction();
        void togglePlayMusic();
      }}
      accessibilityRole="button"
      accessibilityLabel={
        !canTogglePlayback
          ? t("playback.noTrack")
          : musicActive
            ? t("playback.pauseMusic")
            : t("playback.playMusic")
      }
      accessibilityState={{ disabled: !canTogglePlayback }}
    />
  );
}
