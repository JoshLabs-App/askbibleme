import { Platform } from "react-native";
import { setAudioModeAsync, type AudioMode, type AudioPlayer, type AudioSource } from "expo-audio";
import { isShellNativeAudioTakeover } from "./shellNativeAudioTakeover";

type ShellAudioModeKind = "music" | "scripture";

let shellAudioModeState: ShellAudioModeKind | null = null;
let shellAudioModeInFlight: Promise<void> | null = null;

async function ensureShellAudioMode(
  kind: ShellAudioModeKind,
  options: Partial<AudioMode>,
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
  shellAudioModeInFlight = setAudioModeAsync(options)
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
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        // iOS 锁屏 / Control Center 的 Now Playing 展示依赖更“独占”的音频模式；
        // `duckOthers` 会让系统更不愿把它当成可控媒体。安卓则维持旧行为：其它 App 出声时
        // 暂停本 App 朗读，靠 scriptureResumeAfterInterruption 续播。
        interruptionMode: Platform.OS === "ios" ? "doNotMix" : "duckOthers",
        shouldRouteThroughEarpiece: false,
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
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      // 与首页环境音同进程混播；勿用 doNotMix，否则安卓会掐掉环境音轨。
      interruptionMode: "duckOthers",
      shouldRouteThroughEarpiece: false,
    });
  } catch (err) {
    if (__DEV__) {
      console.warn("[playback] configureScriptureShellAudioMode", err);
    }
  }
}

/** Android：`http(s)` 远程流式播放；`file://` 直连；其余 asset 类 URI 先落盘再播。 */
export function shellSoundDownloadFirst(source: AudioSource): boolean {
  if (Platform.OS !== "android") return false;
  if (typeof source !== "object" || source === null || !("uri" in source)) return false;
  const uri = String(source.uri ?? "");
  if (!uri) return false;
  if (/^https?:\/\//i.test(uri)) return false;
  if (/^file:\/\//i.test(uri)) return false;
  return true;
}

/** 创建 Player 后确保可听（模拟器上 playing 为 true 但音量为 0 / 被 duck 的常见兜底）。 */
export async function primeShellSoundPlayback(
  player: AudioPlayer,
  options?: { autoPlay?: boolean },
): Promise<void> {
  await configureShellAudioMode();
  try {
    player.muted = false;
    player.volume = 1;
  } catch {
    /* ignore */
  }
  if (options?.autoPlay === false) return;
  try {
    if (player.isLoaded && !player.playing) {
      player.play();
    }
  } catch {
    /* ignore */
  }
}
