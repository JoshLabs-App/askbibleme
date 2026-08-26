import { useCallback, useState } from "react";
import { ActivityIndicator, Platform } from "react-native";
import { isShellMusicOn, useShellMusicSignals } from "../music/useShellMusicSignals";
import {
  isHomeAlbumAudible,
  resolveHomeAlbumPressAction,
  resolveHomeCenterPlayAction,
} from "./homeNatureAlbumPress";
import { startHomeAlbumPlayback } from "./homeNatureAlbumPlayback";
import { resolveUiText, toZhTwText } from "../i18n/site-copy";
import { useLocale } from "../i18n/LocaleProvider";
import {
  DEFAULT_MUSIC_ALBUM,
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
import { HOME_ALBUM_ICON_SIZE } from "./homeNatureLayoutMetrics";
import { SPLASH_BACKGROUND as LOGO_COLOR } from "../shell/splash-branding.generated";
import { ShellMaterialIcon } from "../shell/ShellMaterialIcon";
import { shellIconTextShadow } from "../shell/shellChromeIcons";

const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.48)";
/** 首页底栏只放这两颗专辑；其它专辑在音乐栏切换。 */
const HOME_ALBUMS = ["安静", "下午茶"];

type Props = {
  goldenVersePlaying: boolean;
  goldenVerseAudible?: boolean;
  goldenVersePreparing?: boolean;
  onToggleGoldenVerse: () => void;
  onPauseVerseTransport?: () => void;
  onResumeVerseTransport?: () => void;
  sceneToolsOpen: boolean;
  onToggleSceneTools: () => void;
  /** 环境音芯片选中时，设置图标保持 LOGO 色（面板收起也亮）。 */
  ambientActive?: boolean;
  onUserActivity?: () => void;
};

export function HomeNatureAlbumStrip({
  goldenVersePlaying,
  goldenVerseAudible = false,
  goldenVersePreparing = false,
  onToggleGoldenVerse,
  onPauseVerseTransport,
  onResumeVerseTransport,
  sceneToolsOpen,
  onToggleSceneTools,
  ambientActive = false,
  onUserActivity,
}: Props) {
  const { locale } = useLocale();
  const playback = useMusicPlaybackOptional();
  /** 只在停播期间记住上次选中的专辑；播放中一律以引擎当前专辑为准。 */
  const [pausedAlbum, setPausedAlbum] = useState<string | null>(null);
  const musicSignals = useShellMusicSignals();

  const playAlbum = useCallback(
    (album: string) => {
      if (!playback) return false;
      return startHomeAlbumPlayback(playback, album, { duckForVerse: goldenVersePlaying });
    },
    [goldenVersePlaying, playback],
  );

  const musicOn = isShellMusicOn(
    musicSignals,
    !!playback?.playing,
    playback?.playbackMode,
  );
  const transportPlaying = musicOn || goldenVerseAudible;

  if (!playback) return null;

  const currentAlbum = normalizeMusicAlbumLabel(playback.tracks[playback.trackIndex]?.album);
  // 引擎可能自动跨专辑续播，选中态必须跟着走，不能停留在上次点过的那颗。
  const homeCurrentAlbum = HOME_ALBUMS.includes(currentAlbum) ? currentAlbum : null;
  const selectedAlbum = musicOn ? (homeCurrentAlbum ?? pausedAlbum) : pausedAlbum;

  const albumSlot = (albumName: string, iconSize: number): MusicHomeTransportSideSlot => {
    const audible = isHomeAlbumAudible({
      albumName,
      currentAlbum,
      playbackMode: playback.playbackMode,
      nativePlaying: musicSignals.nativePlaying,
      jsPlaying: playback.playing,
      wantPlaying: musicSignals.wantPlaying,
      platform: Platform.OS,
    });
    const selected = audible || selectedAlbum === albumName;
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
    const color = selected ? LOGO_COLOR : canOpen ? INK : MUTED;
    return {
      onPress: () => {
        onUserActivity?.();
        const action = resolveHomeAlbumPressAction({ playable: canOpen, selected });
        if (action === "ignore") return;
        if (action === "stop") {
          setPausedAlbum(null);
          const keepVerse = goldenVersePlaying;
          void playback.pauseShellPlayback().finally(() => {
            if (keepVerse) onResumeVerseTransport?.();
          });
          return;
        }
        const started = playAlbum(albumName);
        if (!started) return;
        setPausedAlbum(albumName);
        if (goldenVersePlaying) onResumeVerseTransport?.();
      },
      selected,
      disabled: !canOpen,
      accessibilityLabel: canOpen
        ? `${label}${selected ? resolveUiText(locale, "（正在播放）", " (playing)") : ""}`
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

  const verseColor = goldenVersePlaying ? LOGO_COLOR : INK;
  const verseSlot: MusicHomeTransportSideSlot = {
    onPress: onToggleGoldenVerse,
    selected: goldenVersePlaying,
    accessibilityLabel: goldenVersePlaying
      ? resolveUiText(locale, "停止金句", "Stop verse")
      : resolveUiText(locale, "播放金句", "Play verse"),
    icon: goldenVersePreparing ? (
      <ActivityIndicator size="small" color={verseColor} />
    ) : (
      <ShellMaterialIcon name="volume-up" size={HOME_ALBUM_ICON_SIZE} color={verseColor} />
    ),
  };

  const settingsLit = sceneToolsOpen || ambientActive;
  const settingsColor = settingsLit ? LOGO_COLOR : INK;
  const settingsSlot: MusicHomeTransportSideSlot = {
    onPress: onToggleSceneTools,
    selected: settingsLit,
    accessibilityLabel: sceneToolsOpen
      ? resolveUiText(locale, "收起场景与音效", "Hide scenes and sounds")
      : resolveUiText(locale, "场景与音效", "Scenes and sounds"),
    icon: <ShellMaterialIcon name="settings" size={HOME_ALBUM_ICON_SIZE} color={settingsColor} />,
  };

  return (
    <MusicHomeTransportButtonRow
      locale={locale}
      playing={transportPlaying}
      canTogglePlayback={playback.tracks.length > 0}
      onTogglePlay={() => {
        onUserActivity?.();
        const albumSelected = selectedAlbum != null;
        const action = resolveHomeCenterPlayAction({
          musicOn,
          verseAudible: goldenVerseAudible,
          albumSelected,
          verseSelected: goldenVersePlaying,
        });
        if (action === "pause") {
          // 停播后 musicOn 转 false，选中态只剩 pausedAlbum，先把它锁住。
          setPausedAlbum(selectedAlbum);
          if (musicOn) void playback.pauseShellPlayback();
          if (goldenVersePlaying) onPauseVerseTransport?.();
          return;
        }
        if (action === "resume") {
          if (albumSelected) void playback.togglePlayMusic();
          if (goldenVersePlaying) onResumeVerseTransport?.();
          return;
        }
        const started = playAlbum(DEFAULT_MUSIC_ALBUM);
        if (started) setPausedAlbum(DEFAULT_MUSIC_ALBUM);
      }}
      playAccessibilityLabel={resolveUiText(locale, "播放音乐", "Play music")}
      pauseAccessibilityLabel={resolveUiText(locale, "暂停音乐", "Pause music")}
      sides={{
        start: albumSlot("安静", HOME_ALBUM_ICON_SIZE),
        beforePlay: albumSlot("下午茶", HOME_ALBUM_ICON_SIZE),
        afterPlay: verseSlot,
        end: settingsSlot,
      }}
    />
  );
}
