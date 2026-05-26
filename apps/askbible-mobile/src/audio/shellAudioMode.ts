import { Platform } from "react-native";
import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  type AVPlaybackSource,
} from "expo-av";

/** 壳层音乐 / 读经朗读：允许切到后台继续播放（需 iOS `UIBackgroundModes: audio`）。 */
export async function configureShellAudioMode(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      // DoNotMix 在部分 Android 模拟器/真机上会导致 isPlaying 但无声
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  } catch (err) {
    if (__DEV__) {
      console.warn("[playback] configureShellAudioMode", err);
    }
  }
}

/** Android 远程 URI 先下载；包内 `require()` 不必 downloadFirst。 */
export function shellSoundDownloadFirst(source: AVPlaybackSource): boolean {
  if (Platform.OS !== "android") return false;
  return typeof source === "object" && source !== null && "uri" in source;
}

/** 创建 Sound 后确保可听（模拟器上 isPlaying 为 true 但音量为 0 / 被 duck 的常见兜底）。 */
export async function primeShellSoundPlayback(sound: Audio.Sound): Promise<void> {
  await configureShellAudioMode();
  try {
    await sound.setIsMutedAsync(false);
    await sound.setVolumeAsync(1);
  } catch {
    /* ignore */
  }
  try {
    const status = await sound.getStatusAsync();
    if (status.isLoaded && !status.isPlaying) {
      await sound.playAsync();
    }
  } catch {
    /* ignore */
  }
}
