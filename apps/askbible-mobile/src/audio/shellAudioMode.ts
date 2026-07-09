import { Platform } from "react-native";
import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  type AVPlaybackSource,
} from "expo-av";

type ShellAudioModeKind = "music" | "scripture";

let shellAudioModeState: ShellAudioModeKind | null = null;
let shellAudioModeInFlight: Promise<void> | null = null;

async function ensureShellAudioMode(
  kind: ShellAudioModeKind,
  options: Parameters<typeof Audio.setAudioModeAsync>[0],
): Promise<void> {
  if (shellAudioModeState === kind) return;
  if (shellAudioModeInFlight) {
    await shellAudioModeInFlight;
    if (shellAudioModeState === kind) return;
  }
  if (shellAudioModeInFlight) {
    await shellAudioModeInFlight;
    if (shellAudioModeState === kind) return;
  }
  shellAudioModeInFlight = Audio.setAudioModeAsync(options)
    .then(() => {
      shellAudioModeState = kind;
    })
    .finally(() => {
      shellAudioModeInFlight = null;
    });
  await shellAudioModeInFlight;
}

/** 壳层音乐 / 读经朗读：允许切到后台继续播放（需 iOS `UIBackgroundModes: audio`）。 */
export async function configureShellAudioMode(): Promise<void> {
  try {
    await ensureShellAudioMode("music", {
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      // iOS 锁屏 / Control Center 的 Now Playing 展示依赖更“独占”的音频模式；
      // `duckOthers` 会让系统更不愿把它当成可控媒体。
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      // shouldDuckAndroid=false：其它 App 出声时会暂停本 App 朗读（expo-av 默认行为）；续播见 scriptureResumeAfterInterruption。
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

/** 圣经朗读：优先占用音频会话，减少与其它 App 混播时被 duck / 打断。 */
export async function configureScriptureShellAudioMode(): Promise<void> {
  try {
    await ensureShellAudioMode("scripture", {
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  } catch (err) {
    if (__DEV__) {
      console.warn("[playback] configureScriptureShellAudioMode", err);
    }
  }
}

/** Android：`http(s)` 远程流式播放；`file://` 直连；其余 asset 类 URI 先落盘再播。 */
export function shellSoundDownloadFirst(source: AVPlaybackSource): boolean {
  if (Platform.OS !== "android") return false;
  if (typeof source !== "object" || source === null || !("uri" in source)) return false;
  const uri = String(source.uri ?? "");
  if (!uri) return false;
  if (/^https?:\/\//i.test(uri)) return false;
  if (/^file:\/\//i.test(uri)) return false;
  return true;
}

/** 创建 Sound 后确保可听（模拟器上 isPlaying 为 true 但音量为 0 / 被 duck 的常见兜底）。 */
export async function primeShellSoundPlayback(
  sound: Audio.Sound,
  options?: { autoPlay?: boolean },
): Promise<void> {
  await configureShellAudioMode();
  try {
    await sound.setIsMutedAsync(false);
    await sound.setVolumeAsync(1);
  } catch {
    /* ignore */
  }
  if (options?.autoPlay === false) return;
  try {
    const status = await sound.getStatusAsync();
    if (status.isLoaded && !status.isPlaying) {
      await sound.playAsync();
    }
  } catch {
    /* ignore */
  }
}
