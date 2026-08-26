import { DeviceEventEmitter } from "react-native";

/** 来电 / 系统音频打断：停播但不清用户「想听」意图，结束后才允许续播。 */
let interrupted = false;
const listeners = new Set<() => void>();
let bridgeInstalled = false;

export function getShellAudioInterrupted(): boolean {
  installShellAudioInterruptionBridge();
  return interrupted;
}

export function setShellAudioInterrupted(next: boolean): void {
  if (interrupted === next) return;
  interrupted = next;
  for (const cb of listeners) cb();
}

export function subscribeShellAudioInterrupted(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function installShellAudioInterruptionBridge(): void {
  if (bridgeInstalled) return;
  if (typeof DeviceEventEmitter?.addListener !== "function") return;
  bridgeInstalled = true;
  DeviceEventEmitter.addListener("AudioSessionInterruptionBegan", () => {
    setShellAudioInterrupted(true);
  });
  DeviceEventEmitter.addListener("AudioSessionInterruptionEnded", () => {
    setShellAudioInterrupted(false);
  });
}
