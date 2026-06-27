import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ActivityIndicator, Pressable, View } from "react-native";
import { translationSupportsChapterAudio } from "../bible/read-chapter-audio";
import { t } from "../i18n/site-copy";
import { useMusicPlaybackOptional } from "../music/MusicPlaybackContext";
import { useReadBibleTypography } from "../read/ReadBibleTypographyContext";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "./splash-branding.generated";
import { ShellMaterialIcon } from "./ShellMaterialIcon";
import { SHELL_TAB_BAR_ICON, shellIconTextShadow } from "./shellChromeIcons";
import { shellTabBarStyles as styles } from "./shellTabBarStyles";

const SCRIPTURE_VOICE_ICON_SIZE = 30;

/** 底栏中央：专用于整章经朗读，与场景首页音乐播放键分离。 */
export function ShellScripturePlayFab() {
  const playback = useMusicPlaybackOptional();
  const { primaryTranslationId } = useReadBibleTypography();
  if (!playback) {
    return <View style={styles.scriptureFabShell} pointerEvents="none" />;
  }

  const {
    playing,
    playbackMode,
    readChapterAudioAvailable,
    scripturePreparing,
    togglePlayScripture,
  } = playback;

  const translationSupportsAudio =
    Boolean(primaryTranslationId) && translationSupportsChapterAudio(primaryTranslationId);
  const canPlay =
    readChapterAudioAvailable || translationSupportsAudio || playbackMode === "scripture";
  const isScripturePlaying = playbackMode === "scripture" && playing;
  const isScripturePreparing = playbackMode === "scripture" && scripturePreparing && !playing;
  const scriptureActive = isScripturePlaying || isScripturePreparing;

  const accessibilityLabel = !canPlay
    ? t("pages.read.chapterAudioUnavailable")
    : isScripturePlaying
      ? t("pages.read.chapterChromeAudioPause")
      : isScripturePreparing
        ? t("pages.read.chapterAudioPreparing")
        : t("pages.read.scriptureSpeaksIconLabel");

  return (
    <Pressable
      onPress={() => void togglePlayScripture()}
      disabled={!canPlay}
      style={({ pressed }) => [
        styles.scriptureFab,
        canPlay && !scriptureActive && styles.scriptureFabIdle,
        scriptureActive && styles.scriptureFabActive,
        !canPlay && styles.scriptureFabDisabled,
        pressed && canPlay ? styles.scriptureFabPressed : null,
      ]}
      accessibilityRole="button"
      accessibilityState={{ busy: isScripturePreparing, disabled: !canPlay }}
      accessibilityLabel={accessibilityLabel}
    >
      {isScripturePreparing ? (
        <ActivityIndicator size="small" color={LOGO_COLOR} />
      ) : isScripturePlaying ? (
        <ShellMaterialIcon name="pause" size={28} color={LOGO_COLOR} />
      ) : (
        <MaterialCommunityIcons
          name="account-voice"
          size={SCRIPTURE_VOICE_ICON_SIZE}
          color={canPlay ? "rgba(255,255,255,0.92)" : SHELL_TAB_BAR_ICON}
          style={shellIconTextShadow()}
        />
      )}
    </Pressable>
  );
}
