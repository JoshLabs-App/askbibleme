import { DeviceEventEmitter } from "react-native";
import { setShellMusicNativePlaying } from "./shellMusicNativePlaying";
import { setShellMusicWantPlaying } from "./shellMusicWantPlaying";
import { setShellNativeAudioTakeover } from "./shellNativeAudioTakeover";

/** 读经等 aux 开播时清掉壳层音乐意图，避免首页音乐键仍以为在播音乐。 */
export const SHELL_MUSIC_PAUSE_FOR_AUX = "ShellMusicPauseForAux";

export function pauseShellMusicForAux(reason: string): void {
  setShellMusicWantPlaying(false);
  setShellMusicNativePlaying(false);
  setShellNativeAudioTakeover(false);
  // iOS 还需停原生 AVPlayer；Android 监听方会清 playingState 并 pause 空 soundRef。
  DeviceEventEmitter.emit(SHELL_MUSIC_PAUSE_FOR_AUX, { reason });
}
