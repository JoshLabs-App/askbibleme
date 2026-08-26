import { useCallback } from "react";
import { ActivityIndicator, Platform } from "react-native";
import { isShellMusicOn, useShellMusicSignals } from "../music/useShellMusicSignals";
import { isHomeAlbumAudible, resolveHomeAlbumPressAction } from "./homeNatureAlbumPress";
import { startHomeAlbumPlayback } from "./homeNatureAlbumPlayback";
import { resolveUiText, toZhTwText } from "../i18n/site-copy";
import { useLocale } from "../i18n/LocaleProvider";
import {
  musicAlbumShortLabel,
  musicAlbumShortLabelEn,
  normalizeMusicAlbumLabel,
} from "../music/musicAlbumCatalog";
import { useMusicPlaybackOptional } from "../music/MusicPlaybackContext";
import {
  MusicHomeTransportButtonRow,
  type MusicHomeTransportSideSlot,
} from "../music/MusicHomeTransportButtonRow";
import { MusicAlbumGlyph } from "../music/MusicAlbumGlyph";
import { isTrackPlayable } from "../music/trackArtwork";
import { HOME_ALBUM_BTN_SIZE, HOME_ALBUM_ICON_SIZE } from "./homeNatureLayoutMetrics";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "../shell/splash-branding.generated";
import { ShellMaterialIcon } from "../shell/ShellMaterialIcon";
import { shellIconTextShadow } from "../shell/shellChromeIcons";

const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.48)";

type Props = {
  goldenVerseOn: boolean;
  goldenVersePreparing?: boolean;
  onToggleGoldenVerse: () => void;
  onUserActivity?: () => void;
};

export function HomeNatureAlbumStrip({
  goldenVerseOn,
  goldenVersePreparing = false,
  onToggleGoldenVerse,
  onUserActivity,
}: Props) {
  const { locale } = useLocale();
  const playback = useMusicPlaybackOptional();
  const musicSignals = useShellMusicSignals();

  const playAlbum = useCallback(
    (album: string) => {
      if (!playback) return false;
      return startHomeAlbumPlayback(playback, album, { duckForVerse: goldenVerseOn });
    },
    [goldenVerseOn, playback],
  );

  const musicOn = isShellMusicOn(
    musicSignals,
    !!playback?.playing,
    playback?.playbackMode,
  );

  if (!playback) return null;

  const currentAlbum = normalizeMusicAlbumLabel(playback.tracks[playback.trackIndex]?.album);

  const albumSlot = (albumName: string, iconSize: number): MusicHomeTransportSideSlot => {
    const on = isHomeAlbumAudible({
      albumName,
      currentAlbum,
      playbackMode: playback.playbackMode,
      nativePlaying: musicSignals.nativePlaying,
      jsPlaying: playback.playing,
      wantPlaying: musicSignals.wantPlaying,
      platform: Platform.OS,
    });
    const inCatalog = playback.tracks.some(
      (track) => normalizeMusicAlbumLabel(track.album) === albumName,
    );
    const playable = playback.tracks.some(
      (track) =>
        isTrackPlayable(track) && normalizeMusicAlbumLabel(track.album) === albumName,
    );
    const canOpen = inCatalog || playable;
    const labelZh = musicAlbumShortLabel(albumName);
    const label =
      locale === "en"
        ? musicAlbumShortLabelEn(albumName)
        : locale === "zh-TW"
          ? toZhTwText(labelZh)
          : labelZh;
    const color = on ? LOGO_COLOR : canOpen ? INK : MUTED;
    return {
      onPress: () => {
        onUserActivity?.();
        const action = resolveHomeAlbumPressAction({ playable: canOpen, selected: on });
        if (action === "ignore") return;
        if (action === "deselect") {
          if (musicOn && currentAlbum === albumName) {
            void playback.pauseShellPlayback();
          }
          return;
        }
        void playAlbum(albumName);
      },
      selected: on,
      disabled: !canOpen,
      accessibilityLabel: canOpen
        ? on
          ? resolveUiText(locale, `关闭${labelZh}`, `Turn off ${label}`)
          : resolveUiText(locale, `播放${labelZh}`, `Play ${label}`)
        : `${label}${resolveUiText(locale, "（暂无曲目）", " (empty)")}`,
      icon: (
        <MusicAlbumGlyph
          album={albumName}
          size={iconSize}
          color={color}
          style={shellIconTextShadow()}
        />
      ),
    };
  };

  const verseColor = goldenVerseOn ? LOGO_COLOR : INK;
  const verseSlot: MusicHomeTransportSideSlot = {
    onPress: () => {
      onUserActivity?.();
      onToggleGoldenVerse();
    },
    selected: goldenVerseOn,
    accessibilityLabel: goldenVerseOn
      ? resolveUiText(locale, "关闭金句朗读", "Turn off verse")
      : resolveUiText(locale, "播放金句朗读", "Play verse"),
    icon: goldenVersePreparing ? (
      <ActivityIndicator size="small" color={verseColor} />
    ) : (
      <ShellMaterialIcon name="volume-up" size={HOME_ALBUM_ICON_SIZE} color={verseColor} />
    ),
  };

  return (
    <MusicHomeTransportButtonRow
      locale={locale}
      playing={false}
      canTogglePlayback={false}
      onTogglePlay={() => {}}
      hideCenterPlay
      sideButtonSize={HOME_ALBUM_BTN_SIZE}
      sides={{
        start: albumSlot("安静", HOME_ALBUM_ICON_SIZE),
        beforePlay: verseSlot,
        afterPlay: albumSlot("下午茶", HOME_ALBUM_ICON_SIZE),
      }}
    />
  );
}
