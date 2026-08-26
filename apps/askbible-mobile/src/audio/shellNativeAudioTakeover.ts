import { Platform } from "react-native";

/** iOS / Android：music / 读经由原生播放器独占时，JS/expo-av 勿再抢播或改写音频会话。 */
let nativeAudioTakeover = false;
const listeners = new Set<(next: boolean) => void>();

/** 音乐与读经主轨走原生（金句 Android 已另有原生轨）。 */
export function isNativeMainTrackOs(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export function isShellNativeAudioTakeover(): boolean {
  return nativeAudioTakeover;
}

export function setShellNativeAudioTakeover(next: boolean): void {
  if (nativeAudioTakeover === next) return;
  nativeAudioTakeover = next;
  for (const listener of listeners) listener(next);
}

export function subscribeShellNativeAudioTakeover(listener: (next: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
