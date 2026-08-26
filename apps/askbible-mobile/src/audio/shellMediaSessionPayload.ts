import { getShellAuxMediaOwner } from "./shellAuxMediaOwner";
import { syncShellMediaSession, type ShellMediaSessionPayload } from "./shellMediaControls";
import { Platform } from "react-native";
import {
  getShellMusicPlayableAssetUri,
  isIosNativePlayableMusicUri,
  isPlausibleShellMusicAssetUri,
  normalizeShellMusicFileUri,
} from "./shellMusicPlayableAssetUri";
import { getShellMediaSceneArtworkUri } from "./shellMediaSceneArtwork";
import { getShellMusicWantPlaying } from "./shellMusicWantPlaying";
import type { MusicPlaybackMode } from "../music/musicPlaybackTypes";
import type { PlaybackTrack } from "../music/types";
import type { ReadChapterPlaybackRegistration } from "../music/scripturePlaybackTypes";
import {
  getActiveReadChapterPlayback,
  resolveTransportReadChapterPlayback,
} from "../read/read-chapter-playback-store";

export type ShellMediaSessionArgs = {
  playing: boolean;
  playbackMode: MusicPlaybackMode;
  tracks: PlaybackTrack[];
  trackIndex: number;
  musicCurrentSec: number;
  musicDurationSec: number;
  scriptureCurrentSec: number;
  scriptureDurationSec: number;
  readChapter: ReadChapterPlaybackRegistration | null;
};

const liveArgsRef: { current: ShellMediaSessionArgs | null } = { current: null };

export function setShellMediaSessionLiveArgs(args: ShellMediaSessionArgs): void {
  liveArgsRef.current = args;
}

/** iOS 原生开播前立刻对齐 live args，避免 React 尚未重渲时 refresh 用到旧曲目。 */
export function patchShellMediaSessionLiveArgs(
  patch: Partial<ShellMediaSessionArgs>,
): void {
  const base = liveArgsRef.current;
  if (!base) {
    liveArgsRef.current = {
      playing: false,
      playbackMode: "music",
      tracks: [],
      trackIndex: 0,
      musicCurrentSec: 0,
      musicDurationSec: 0,
      scriptureCurrentSec: 0,
      scriptureDurationSec: 0,
      readChapter: null,
      ...patch,
    };
    return;
  }
  liveArgsRef.current = { ...base, ...patch };
}

export function buildShellMediaSessionPayload(
  args: ShellMediaSessionArgs,
): ShellMediaSessionPayload | null {
  const {
    playing,
    playbackMode,
    tracks,
    trackIndex,
    musicCurrentSec,
    musicDurationSec,
    scriptureCurrentSec,
    scriptureDurationSec,
    readChapter,
  } = args;

  if (playbackMode === "music") {
    const track = tracks[trackIndex];
    if (!track) return null;
    const playable = getShellMusicPlayableAssetUri();
    const trackSrc = (track.src || "").trim();
    const pickMusicUri = (uri: string): string => {
      if (!uri) return "";
      if (Platform.OS === "ios") {
        return isIosNativePlayableMusicUri(uri) ? uri : "";
      }
      return isPlausibleShellMusicAssetUri(uri) ? uri : "";
    };
    // 优先当前曲目自身 URI；全局 playable 仅在像音乐文件时采用（防环境音污染）。
    // iOS 允许 TEMP HTTPS（R2 / 圣诗）；勿把 Metro http 当 assetUri。
    const rawAsset = (pickMusicUri(playable || "") || pickMusicUri(trackSrc)).trim();
    return {
      title: track.title,
      artist: track.artist,
      album: track.album,
      assetUri: rawAsset ? normalizeShellMusicFileUri(rawAsset) : rawAsset,
      artworkUri: getShellMediaSceneArtworkUri(),
      durationSec: musicDurationSec > 0 ? musicDurationSec : track.durationSec ?? 0,
      positionSec: musicCurrentSec,
      playing,
      kind: "music",
    };
  }

  const chapter = readChapter ?? resolveTransportReadChapterPlayback() ?? getActiveReadChapterPlayback();
  if (!chapter) return null;
  return {
    title: `${chapter.bookName} ${chapter.chapter}`,
    artist: "AskBible.me",
    album: chapter.translationId,
    assetUri: chapter.chapterAudioSrc,
    artworkUri: getShellMediaSceneArtworkUri(),
    durationSec: scriptureDurationSec,
    positionSec: scriptureCurrentSec,
    playing,
    kind: "scripture",
  };
}

export function refreshShellMediaSession(
  overrides?: Partial<
    Pick<
      ShellMediaSessionArgs,
      | "playing"
      | "musicCurrentSec"
      | "musicDurationSec"
      | "scriptureCurrentSec"
      | "scriptureDurationSec"
    >
  >,
): void {
  const base = liveArgsRef.current;
  if (!base) return;
  const merged = { ...base, ...overrides };
  // 壳层未在播时，保留环境音 / 金句等辅助播放器的锁屏会话，避免关屏瞬间被清掉前台服务。
  if (!merged.playing) {
    if (getShellMusicWantPlaying()) {
      // UI 短暂 playing=false 时仍保持音乐会话，勿清、勿让 aux 抢走。
      const keep = buildShellMediaSessionPayload({ ...merged, playing: true });
      if (keep) {
        syncShellMediaSession(keep);
        return;
      }
    }
    const auxPayload = getShellAuxMediaOwner()?.buildPayload() ?? null;
    if (auxPayload) {
      syncShellMediaSession(auxPayload);
      return;
    }
  }
  // 金句正在播且用户未要求听歌：勿用音乐会话盖住金句（否则 Android 关屏无前台服务会断播）。
  if (merged.playbackMode === "music" && !getShellMusicWantPlaying()) {
    const auxPayload = getShellAuxMediaOwner()?.buildPayload() ?? null;
    if (auxPayload?.playing && auxPayload.kind === "verse") {
      syncShellMediaSession(auxPayload);
      return;
    }
  }
  // 音乐意图在播：始终推音乐元数据，避免 aux 抢标题。
  if (getShellMusicWantPlaying() && merged.playbackMode === "music") {
    const keep = buildShellMediaSessionPayload({ ...merged, playing: true });
    if (keep) {
      syncShellMediaSession(keep);
      return;
    }
  }
  const payload = buildShellMediaSessionPayload(
    merged.playbackMode === "music"
      ? { ...merged, playing: getShellMusicWantPlaying() && merged.playing }
      : merged,
  );
  if (!payload) {
    if (getShellMusicWantPlaying()) return;
    const auxPayload = getShellAuxMediaOwner()?.buildPayload() ?? null;
    if (auxPayload) {
      syncShellMediaSession(auxPayload);
      return;
    }
    syncShellMediaSession(null);
    return;
  }
  if (!payload.playing && payload.positionSec <= 0 && payload.durationSec <= 0) {
    if (getShellMusicWantPlaying()) return;
    const auxPayload = getShellAuxMediaOwner()?.buildPayload() ?? null;
    if (auxPayload) {
      syncShellMediaSession(auxPayload);
      return;
    }
    syncShellMediaSession(null);
    return;
  }
  syncShellMediaSession(payload);
}
