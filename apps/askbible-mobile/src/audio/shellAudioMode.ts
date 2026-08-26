import { Platform } from "react-native";
import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  type AVPlaybackSource,
} from "expo-av";
import { isShellNativeAudioTakeover } from "./shellNativeAudioTakeover";

type ShellAudioModeKind = "music" | "scripture";

let shellAudioModeState: ShellAudioModeKind | null = null;
let shellAudioModeInFlight: Promise<void> | null = null;

async function ensureShellAudioMode(
  kind: ShellAudioModeKind,
  options: Parameters<typeof Audio.setAudioModeAsync>[0],
  force = false,
): Promise<void> {
  // 原生播放器占会话时：禁止 expo-av 再改系统音频模式（会把后台音乐掐掉）。
  if (isShellNativeAudioTakeover()) return;
  if (!force && shellAudioModeState === kind) return;
  if (shellAudioModeInFlight) {
    await shellAudioModeInFlight;
    if (!force && shellAudioModeState === kind) return;
  }
  if (shellAudioModeInFlight) {
    await shellAudioModeInFlight;
    if (!force && shellAudioModeState === kind) return;
  }
  if (isShellNativeAudioTakeover()) return;
  // force 时先清缓存，避免环境音/视频改了系统会话后这里误以为仍是 music。
  if (force) shellAudioModeState = null;
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
export async function configureShellAudioMode(opts?: { force?: boolean }): Promise<void> {
  if (isShellNativeAudioTakeover()) return;
  try {
    await ensureShellAudioMode(
      "music",
      {
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
      },
      opts?.force === true,
    );
  } catch (err) {
    if (__DEV__) {
      console.warn("[playback] configureShellAudioMode", err);
    }
  }
}

/** 圣经朗读：可与同 App 环境音混播；环境音由上层 duck 到约 30%。 */
export async function configureScriptureShellAudioMode(): Promise<void> {
  if (isShellNativeAudioTakeover()) return;
  try {
    await ensureShellAudioMode("scripture", {
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      // 与首页环境音同进程混播；勿用 DoNotMix，否则安卓会掐掉环境音轨。
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
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
