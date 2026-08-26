import { useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { translationSupportsChapterAudio } from "../bible/read-chapter-audio";
import { t } from "../i18n/site-copy";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { ShellMaterialIcon } from "../shell/ShellMaterialIcon";
import {
  getScripturePlayingChapter,
  subscribeScripturePlayingChapter,
} from "../music/scripturePlayingChapterStore";
import { SPLASH_BACKGROUND as LOGO_YELLOW } from "../shell/splash-branding.generated";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { READ_TOP_CHROME } from "./readTopChrome";
import { readChapterScreenStyles as styles } from "./readChapterScreenStyles";

type Props = {
  bookId: string;
  chapter: number;
  bookName: string;
  /** 标题旁：跟章题字号；右侧栏：白图标竖排 */
  appearance?: "inline" | "chrome";
  iconSize?: number;
  disabled?: boolean;
};

/** 本章朗读：播放 / 暂停（不走底栏中央键的计划页跳转）。 */
export function ReadChapterTitleAudioButton({
  bookId,
  chapter,
  bookName,
  appearance = "inline",
  iconSize: iconSizeProp,
  disabled = false,
}: Props) {
  const {
    playing,
    playbackMode,
    scripturePreparing,
    playScriptureChapter,
    togglePlayScripture,
  } = useMusicPlayback();
  const { chapterAudioTranslationId } = useReadBibleTypography();
  const [tapPending, setTapPending] = useState(false);
  const playingChapter = useSyncExternalStore(
    subscribeScripturePlayingChapter,
    getScripturePlayingChapter,
    getScripturePlayingChapter,
  );

  const chrome = appearance === "chrome";
  const iconSize = iconSizeProp ?? (chrome ? READ_TOP_CHROME.iconSize : 22);
  const supported = translationSupportsChapterAudio(chapterAudioTranslationId);
  const isThisChapter =
    playingChapter?.bookId === bookId &&
    playingChapter?.chapter === chapter &&
    playingChapter?.translationId === chapterAudioTranslationId;
  const preparingThis = tapPending || (scripturePreparing && isThisChapter);
  const isPlayingThis =
    isThisChapter && playbackMode === "scripture" && playing && !scripturePreparing;
  const busy = preparingThis || isPlayingThis;
  const inactive = disabled || !supported;
  const iconColor = chrome
    ? busy
      ? LOGO_YELLOW
      : READ_TOP_CHROME.iconColor
    : busy
      ? LOGO_YELLOW
      : c.inkSoft;

  return (
    <Pressable
      onPress={() => {
        if (inactive || tapPending) return;
        if (isPlayingThis || (preparingThis && isThisChapter)) {
          setTapPending(false);
          // 暂停保留会话，便于坞续播；勿 stop 清状态导致再点无效
          void togglePlayScripture({ forcePause: true });
          return;
        }
        setTapPending(true);
        void playScriptureChapter({
          bookId,
          chapter,
          bookName,
          translationId: chapterAudioTranslationId,
        }).finally(() => setTapPending(false));
      }}
      disabled={inactive}
      hitSlop={chrome ? 0 : 10}
      style={({ pressed }) => [
        chrome ? styles.topActionBtn : null,
        { opacity: inactive ? 0.35 : pressed ? 0.7 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: preparingThis }}
      accessibilityLabel={
        !supported
          ? t("pages.read.chapterAudioUnavailable")
          : preparingThis
            ? t("pages.read.chapterAudioPreparing")
            : isPlayingThis
              ? t("pages.read.chapterChromeAudioPause")
              : t("pages.read.chapterAudioPlay")
      }
    >
      <View style={{ width: iconSize, height: iconSize, alignItems: "center", justifyContent: "center" }}>
        {preparingThis ? (
          <ActivityIndicator size="small" color={chrome ? READ_TOP_CHROME.iconColor : LOGO_YELLOW} />
        ) : (
          <ShellMaterialIcon
            name="volume-up"
            size={iconSize}
            color={iconColor}
            shadow={chrome}
          />
        )}
      </View>
    </Pressable>
  );
}
