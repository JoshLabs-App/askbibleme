import {
  normalizeShellMusicFileUri,
  setShellMusicPlayableAssetUri,
} from "../audio/shellMusicPlayableAssetUri";
import {
  clearShellMediaSessionUserDismissed,
  resumeShellAppMusic,
  syncShellMediaSessionExplicit,
} from "../audio/shellMediaControls";
import { reshuffleShellMediaSceneArtwork } from "../audio/shellMediaSceneArtwork";
import { patchShellMediaSessionLiveArgs } from "../audio/shellMediaSessionPayload";
import { setShellMusicNativePlaying } from "../audio/shellMusicNativePlaying";
import { setShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { isNativeMainTrackOs, setShellNativeAudioTakeover } from "../audio/shellNativeAudioTakeover";
import { setShellScriptureWantPlaying } from "../audio/shellScriptureWantPlaying";
import { Platform } from "react-native";
import { warmBundledModuleUri } from "./musicTrackPlayback";
import type { PlaybackTrack } from "./types";

/** 解析 iOS 原生 AVAudioPlayer 可用的本地 file URI（不经 expo-av）。 */
export async function resolveIosNativeMusicAssetUri(
  track: PlaybackTrack,
): Promise<string | null> {
  if (track.bundledModule != null) {
    const warmed = await warmBundledModuleUri(track.bundledModule);
    if (warmed && !/^https?:\/\//i.test(warmed)) return warmed;
  }
  const raw = (track.src || "").trim();
  if (!raw) return null;
  // TEMP：非首曲 R2 HTTPS 交给原生 AVPlayer；本机 Metro http 仍不走（空转无声）。
  if (/^https:\/\//i.test(raw)) return raw;
  if (/^http:\/\//i.test(raw)) return null;
  const normalized = normalizeShellMusicFileUri(raw);
  return normalized || null;
}

type StartArgs = {
  tracks: PlaybackTrack[];
  track: PlaybackTrack;
  index: number;
  positionSec: number;
  shouldPlay: boolean;
  unloadCurrent: () => Promise<void>;
  setTrackIndex: (index: number) => void;
  setPlaybackMode: (mode: "music" | "scripture") => void;
  setPlaying: (playing: boolean) => void;
  setMusicCurrentSec: (sec: number) => void;
  setMusicDurationSec: (sec: number) => void;
  persistMusicResume: (trackId: string, positionSec: number) => void | Promise<void>;
  trackIndexRef: { current: number };
  playbackModeRef: { current: "music" | "scripture" };
  playingStateRef: { current: boolean };
  lastMusicProgressSecRef: { current: number };
};

/**
 * iOS：音乐只走 App 主工程 AVAudioPlayer。
 * 不创建 expo-av Sound，避免双轨与会话污染。
 */
export async function startIosNativeMusicTrack(args: StartArgs): Promise<boolean> {
  if (!isNativeMainTrackOs()) return false;

  const assetUri = await resolveIosNativeMusicAssetUri(args.track);
  if (!assetUri) return false;

  await args.unloadCurrent();
  setShellMusicPlayableAssetUri(assetUri);
  // 读经与音乐互斥；金句可与音乐混播，勿清 verse want。
  setShellScriptureWantPlaying(false);

  const durationSec =
    typeof args.track.durationSec === "number" && args.track.durationSec > 0
      ? args.track.durationSec
      : 0;
  const positionSec = Math.max(0, args.positionSec);

  args.trackIndexRef.current = args.index;
  args.playbackModeRef.current = "music";
  args.setTrackIndex(args.index);
  args.setPlaybackMode("music");
  args.setMusicCurrentSec(positionSec);
  args.lastMusicProgressSecRef.current = positionSec;
  if (durationSec > 0) args.setMusicDurationSec(durationSec);
  void args.persistMusicResume(args.track.id, positionSec);

  patchShellMediaSessionLiveArgs({
    tracks: args.tracks,
    playbackMode: "music",
    trackIndex: args.index,
    musicCurrentSec: positionSec,
    ...(durationSec > 0 ? { musicDurationSec: durationSec } : {}),
    playing: args.shouldPlay,
  });

  const artworkUri = await reshuffleShellMediaSceneArtwork();
  const sessionBase = {
    title: args.track.title,
    artist: args.track.artist,
    album: args.track.album,
    assetUri,
    artworkUri,
    durationSec,
    positionSec,
    kind: "music" as const,
  };

  if (!args.shouldPlay) {
    setShellMusicWantPlaying(false);
    args.playingStateRef.current = false;
    args.setPlaying(false);
    setShellNativeAudioTakeover(true);
    syncShellMediaSessionExplicit({
      ...sessionBase,
      playing: false,
    });
    return true;
  }

  clearShellMediaSessionUserDismissed();
  setShellMusicWantPlaying(true);
  setShellMusicNativePlaying(true);
  args.playingStateRef.current = true;
  args.setPlaying(true);
  setShellNativeAudioTakeover(true);
  // 安卓：先让首页暂停封面解码再挂原生会话，减轻抢焦点；勿卸视频以免切静帧抖动。
  if (Platform.OS === "android") {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 48);
      });
    });
  }
  // 显式带 assetUri + userPlay：越过 userPaused，且不被环境音/金句 URI 污染。
  syncShellMediaSessionExplicit({
    ...sessionBase,
    playing: true,
    userPlay: true,
  });
  // 清 Expo / App 两侧 userPaused；若曲目已在原生暂停，立刻续上。
  resumeShellAppMusic();
  return true;
}
