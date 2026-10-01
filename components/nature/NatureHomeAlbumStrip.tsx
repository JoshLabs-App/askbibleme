"use client";

import { useCallback, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { MusicAlbumGlyph } from "@/components/music/MusicAlbumGlyph";
import type { MusicHomeTransportSideSlot } from "@/components/music/MusicHomeTransportButtonRow";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import {
  isHomeAlbumAudibleWeb,
  resolveHomeAlbumPressAction,
  resolveHomeCenterPlayAction,
} from "@/lib/home/home-nature-album-press";
import {
  isShellMusicOnWeb,
  resolveCurrentMusicAlbumWeb,
  startHomeAlbumPlaybackWeb,
} from "@/lib/home/home-nature-album-playback";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import { DEFAULT_MUSIC_ALBUM, inferTrackAlbumFromCompanionTrack, normalizeMusicAlbumLabel } from "@/lib/music/album-playback";
import {
  musicAlbumShortLabel,
  musicAlbumShortLabelEn,
} from "@/lib/music/music-album-catalog-ui";

const INK = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.48)";
const LOGO_COLOR = "var(--brand-logo-background)";
/** 安卓 `ShellMetrics.tabIconSize`：三个键的图标一样大 */
const HOME_ALBUM_ICON_SIZE = 36;
const HOME_ALBUMS = ["安静", "下午茶"];

type Props = {
  goldenVersePlaying: boolean;
  goldenVerseAudible?: boolean;
  goldenVersePreparing?: boolean;
  onToggleGoldenVerse: () => void;
  onPauseVerseTransport?: () => void;
  onResumeVerseTransport?: () => void;
};

/**
 * 首页最下一排：安静 / 金句朗读 / 下午茶 三个开关，和安卓 `HomeScreen` 的 HomeNatureAlbumStrip 一致
 * （52 触控、间距 28、图标 36，开着亮 LOGO 黄）。场景与音效的开关在右上角齿轮，这里不再放播放键和齿轮。
 */
export function NatureHomeAlbumStrip({
  goldenVersePlaying,
  goldenVerseAudible = false,
  goldenVersePreparing = false,
  onToggleGoldenVerse,
  onResumeVerseTransport,
}: Props) {
  const { locale } = useLocale();
  const playback = useMusicShellPlayback();
  const [pausedAlbum, setPausedAlbum] = useState<string | null>(null);

  const playAlbum = useCallback(
    (album: string) => startHomeAlbumPlaybackWeb(playback, album, { duckForVerse: goldenVersePlaying }),
    [goldenVersePlaying, playback],
  );

  const musicOn = isShellMusicOnWeb(playback);
  const transportPlaying = musicOn || goldenVerseAudible;
  const currentAlbum = resolveCurrentMusicAlbumWeb(playback);
  const homeCurrentAlbum = HOME_ALBUMS.includes(currentAlbum) ? currentAlbum : null;
  const selectedAlbum = musicOn ? (homeCurrentAlbum ?? pausedAlbum) : pausedAlbum;

  const storeTracks = playback.musicStore?.audioTracks.filter((t) => Boolean(t.src?.trim())) ?? [];

  const albumSlot = (albumName: string, iconSize: number): MusicHomeTransportSideSlot => {
    const audible = isHomeAlbumAudibleWeb({
      albumName,
      effectiveSrc: playback.effectiveSrc,
      playing: playback.playing,
      currentAlbum,
    });
    const selected = audible || selectedAlbum === albumName;
    const inCatalog = storeTracks.some(
      (track) => normalizeMusicAlbumLabel(inferTrackAlbumFromCompanionTrack(track)) === albumName,
    );
    const playable = storeTracks.some(
      (track) =>
        Boolean(track.src?.trim()) &&
        normalizeMusicAlbumLabel(inferTrackAlbumFromCompanionTrack(track)) === albumName,
    );
    const canOpen = inCatalog || playable || storeTracks.length > 0;
    const labelZh = musicAlbumShortLabel(albumName);
    const label =
      locale === "en"
        ? musicAlbumShortLabelEn(albumName)
        : locale === "zh-TW"
          ? toZhTwText(labelZh)
          : labelZh;
    const color = selected ? LOGO_COLOR : canOpen ? INK : MUTED;
    const zh = locale === "zh-CN" || locale === "zh-TW";
    return {
      onPress: () => {
        const action = resolveHomeAlbumPressAction({ playable: canOpen, selected });
        if (action === "ignore") return;
        if (action === "stop") {
          setPausedAlbum(null);
          const keepVerse = goldenVersePlaying;
          playback.pausePlayback();
          if (keepVerse) onResumeVerseTransport?.();
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
        ? `${label}${selected ? (zh ? "（正在播放）" : " (playing)") : ""}`
        : `${label}${zh ? "（暂无曲目）" : " (empty)"}`,
      icon: (
        <MusicAlbumGlyph
          album={albumName}
          size={iconSize}
          color={color}
          style={{ filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.55))" }}
        />
      ),
    };
  };

  const verseColor = goldenVersePlaying ? LOGO_COLOR : INK;
  const zh = locale === "zh-CN" || locale === "zh-TW";
  const verseSlot: MusicHomeTransportSideSlot = {
    onPress: onToggleGoldenVerse,
    selected: goldenVersePlaying,
    accessibilityLabel: goldenVersePlaying
      ? zh
        ? "停止金句"
        : "Stop verse"
      : zh
        ? "播放金句"
        : "Play verse",
    icon: goldenVersePreparing ? (
      <span className="nature-home-verse-spinner" aria-hidden />
    ) : (
      <ShellMaterialIcon
        name="volume-up"
        size={HOME_ALBUM_ICON_SIZE}
        color={verseColor}
        legibilityShadow
      />
    ),
  };

  const slots: { key: string; slot: MusicHomeTransportSideSlot }[] = [
    { key: "calm", slot: albumSlot("安静", HOME_ALBUM_ICON_SIZE) },
    { key: "verse", slot: verseSlot },
    { key: "tea", slot: albumSlot("下午茶", HOME_ALBUM_ICON_SIZE) },
  ];

  return (
    <div className="nature-home-album-strip" data-shell-swipe-nav-exclude>
      {slots.map(({ key, slot }) => (
        <button
          key={key}
          type="button"
          onClick={slot.onPress}
          disabled={slot.disabled}
          aria-pressed={slot.selected}
          aria-label={slot.accessibilityLabel}
          className="nature-home-album-strip__btn"
        >
          {slot.icon}
        </button>
      ))}
    </div>
  );
}
