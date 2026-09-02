import { createAudioPlayer, type AudioPlayer, type AudioSource } from "expo-audio";
import { waitForAudioPlayerLoaded } from "../audio/expoAudioPlayerReady";
import { useEffect, useRef } from "react";
import { DeviceEventEmitter, Platform } from "react-native";
import { getShellAudioInterrupted } from "../audio/shellAudioInterruption";
import {
  configureShellAudioMode,
  primeShellSoundPlayback,
  shellSoundDownloadFirst,
} from "../audio/shellAudioMode";
import {
  getShellAuxMediaOwner,
  setShellAuxMediaOwner,
} from "../audio/shellAuxMediaOwner";
import { syncShellMediaSessionExplicit } from "../audio/shellMediaControls";
import { getShellMusicWantPlaying } from "../audio/shellMusicWantPlaying";
import { getShellScriptureWantPlaying } from "../audio/shellScriptureWantPlaying";
import { getShellVerseWantPlaying } from "../audio/shellVerseWantPlaying";
import {
  getShellMediaSceneArtworkUri,
  reshuffleShellMediaSceneArtwork,
} from "../audio/shellMediaSceneArtwork";
import { refreshShellMediaSession } from "../audio/shellMediaSessionPayload";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { warmBundledModuleUri } from "../music/musicTrackPlayback";
import {
  registerNatureAmbientExclusiveStop,
  registerNatureAmbientRemoteGate,
} from "./natureAmbientExclusiveStop";

export type NatureAmbientLayer = {
  layerId: string;
  src: string;
  volume: number;
  /** Metro `require(.mp3)` 资源 id */
  assetModule?: number;
};

export type NatureAmbientSystemMedia = {
  enabled: boolean;
  title: string;
  artist?: string;
};

export const EMPTY_NATURE_AMBIENT_LAYERS: NatureAmbientLayer[] = [];

const AMBIENT_MEDIA_OWNER_ID = "nature-ambient";

/** 安卓 ExoPlayer：无 scheme 的 raw 名 → RawResourceDataSource（勿用 file:///android_res）。 */
function isAndroidRawResourceUri(uri: string): boolean {
  const u = uri.trim();
  if (!u) return false;
  return !u.includes("://") && !u.startsWith("/");
}

/**
 * 环境音 downloadFirst：
 * - Metro `http(s)` 资源：安卓需先落盘
 * - raw 资源名 / file://：禁止 downloadFirst（否则 ExoPlayer 会当远程文件拉、直接失败）
 */
function ambientSoundDownloadFirst(source: AudioSource): boolean {
  if (typeof source === "number") return false;
  if (typeof source === "object" && source !== null && "uri" in source) {
    const uri = String(source.uri ?? "").trim();
    if (!uri) return false;
    if (Platform.OS === "android" && isAndroidRawResourceUri(uri)) return false;
    if (Platform.OS === "android" && /^https?:\/\//i.test(uri)) return true;
    if (/^file:\/\//i.test(uri)) return false;
  }
  return shellSoundDownloadFirst(source);
}

async function resolveAmbientSource(
  layer: NatureAmbientLayer,
  baseUrl: string,
): Promise<AudioSource | null> {
  if (typeof layer.assetModule === "number" && Number.isFinite(layer.assetModule)) {
    // 先预热为 file:// 或 raw 名（warmBundledModuleUri 内已处理安卓回退）
    const localUri = await warmBundledModuleUri(layer.assetModule);
    if (localUri) return { uri: localUri };
    return layer.assetModule;
  }
  const uri = toAbsoluteUrl(baseUrl, layer.src);
  return uri ? { uri } : null;
}

/**
 * 与网站 `NatureAmbientMixAudio` 类似：按场景混音多轨循环环境声。
 * `layersKey` 须随场景 / 混音配置变化，以便卸载旧轨并加载新轨。
 * `deferToExclusiveMusic`：历史独占暂停开关（首页已改为音乐混播，默认 false）。
 * `mixWithVoice`：音乐/金句/读经混播时继续 play 并压音量，且勿把 AudioMode 改回打断主曲。
 */
export function useNatureAmbientMix(
  baseUrl: string,
  layers: NatureAmbientLayer[],
  layersKey: string,
  playbackRate: number,
  active: boolean,
  systemMedia?: NatureAmbientSystemMedia | null,
  deferToExclusiveMusic = false,
  mixWithVoice = false,
) {
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const soundsRef = useRef<AudioPlayer[]>([]);
  // 加载 effect 逐层 await 创建 Sound，期间 layersKey 可能已变；
  // 记录"soundsRef 里实际是哪一版 layersKey 加载出来的"，供 duck/restore 等按下标
  // 对齐 layers[i] 的 effect 判断是否可信，避免拿新 layers 的音量配置套到旧 layersKey
  // 还没卸载完的 sound 上。
  const loadedLayersKeyRef = useRef<string | null>(null);
  const pausedByRemoteRef = useRef(false);
  const deferToMusicRef = useRef(deferToExclusiveMusic);
  deferToMusicRef.current = deferToExclusiveMusic;
  const mixWithVoiceRef = useRef(mixWithVoice);
  mixWithVoiceRef.current = mixWithVoice;
  const systemMediaRef = useRef(systemMedia ?? null);
  systemMediaRef.current = systemMedia ?? null;

  useEffect(() => {
    const stopExclusive = async () => {
      for (const sound of soundsRef.current) {
        try {
          if (sound.isLoaded && sound.playing) sound.pause();
        } catch {
          /* ignore */
        }
      }
    };
    registerNatureAmbientExclusiveStop(stopExclusive);
    registerNatureAmbientRemoteGate({
      pause: async () => {
        pausedByRemoteRef.current = true;
        await stopExclusive();
      },
      resume: async () => {
        pausedByRemoteRef.current = false;
        if (!active || deferToMusicRef.current) {
          return;
        }
        const L = layersRef.current;
        const sounds = soundsRef.current;
        for (let i = 0; i < Math.min(L.length, sounds.length); i += 1) {
          const vol = Math.min(1, Math.max(0, L[i]!.volume));
          if (vol <= 0) continue;
          try {
            const s = sounds[i]!;
            if (!s.isLoaded) continue;
            s.volume = vol;
            if (!s.playing) s.play();
          } catch {
            /* ignore */
          }
        }
      },
      isAudible: () => {
        if (pausedByRemoteRef.current || !active) return false;
        return layersRef.current.some((layer) => layer.volume > 0);
      },
    });
    return () => {
      registerNatureAmbientExclusiveStop(null);
      registerNatureAmbientRemoteGate(null);
    };
  }, [active]);

  useEffect(() => {
    const pauseAmbient = async () => {
      for (const sound of soundsRef.current) {
        try {
          if (sound.isLoaded && sound.playing) sound.pause();
        } catch {
          /* ignore */
        }
      }
    };
    const began = DeviceEventEmitter.addListener("AudioSessionInterruptionBegan", () => {
      void pauseAmbient();
    });
    return () => began.remove();
  }, []);

  useEffect(() => {
    let disposed = false;

    async function disposeAll() {
      const batch = soundsRef.current.splice(0);
      for (const s of batch) {
        try {
          s.remove();
        } catch {
          /* ignore */
        }
      }
    }

    (async () => {
      loadedLayersKeyRef.current = null;
      await disposeAll();
      pausedByRemoteRef.current = false;
      const L = layersRef.current;
      if (!active || L.length === 0) return;
      const deferMusic = deferToMusicRef.current;
      const mixVoice = mixWithVoiceRef.current;

      const aux = getShellAuxMediaOwner();
      // 音乐独占 / 读经混播中都不要把 AudioMode 改成 DoNotMix。
      if (!deferMusic && !mixVoice && (!aux || aux.id === AMBIENT_MEDIA_OWNER_ID)) {
        try {
          await configureShellAudioMode();
        } catch {
          /* ignore */
        }
      }

      if (disposed) return;
      const rate = Math.min(2, Math.max(0.5, playbackRate));

      for (const layer of L) {
        if (disposed) break;
        const source = await resolveAmbientSource(layer, baseUrl);
        if (source == null) continue;
        const vol = Math.min(1, Math.max(0, layer.volume));
        const shouldAutoPlay = vol > 0 && !deferMusic && !pausedByRemoteRef.current;
        try {
          const sound = createAudioPlayer(source, {
            downloadFirst: ambientSoundDownloadFirst(source),
          });
          sound.loop = true;
          sound.volume = vol > 0 ? vol : 0;
          sound.muted = false;
          await waitForAudioPlayerLoaded(sound);
          if (disposed) {
            try {
              sound.remove();
            } catch {
              /* ignore */
            }
            return;
          }
          if (!deferMusic && !mixVoice && (!aux || aux.id === AMBIENT_MEDIA_OWNER_ID)) {
            await primeShellSoundPlayback(sound, { autoPlay: shouldAutoPlay });
          }
          try {
            sound.muted = false;
            sound.volume = vol;
            if (shouldAutoPlay) {
              if (sound.isLoaded && !sound.playing) sound.play();
            } else {
              sound.pause();
            }
          } catch {
            /* ignore */
          }
          if (rate !== 1) {
            try {
              sound.setPlaybackRate(rate, "high");
            } catch {
              /* ignore */
            }
          }
          soundsRef.current.push(sound);
        } catch (err) {
          console.warn("[ambient] load failed", layer.layerId, err);
        }
      }
      if (!disposed) loadedLayersKeyRef.current = layersKey;
    })();

    return () => {
      disposed = true;
      void disposeAll();
    };
  }, [baseUrl, layersKey, playbackRate, active]);

  /** 仅音乐独占时立刻暂停环境音。 */
  useEffect(() => {
    if (!active || !deferToExclusiveMusic) return;
    let cancelled = false;
    void (async () => {
      for (const sound of soundsRef.current) {
        if (cancelled) return;
        try {
          if (sound.isLoaded && sound.playing) sound.pause();
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, deferToExclusiveMusic, layersKey]);

  /** Duck / restore without unload; volume 0 或音乐独占时 pause；读经混播时继续播并压音量。 */
  useEffect(() => {
    const L = layersRef.current;
    if (!active || L.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (cancelled) return;
        if (soundsRef.current.length > 0 && loadedLayersKeyRef.current === layersKey) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      if (cancelled) return;
      // 加载 effect 仍在为新 layersKey 逐层灌音（soundsRef 还是旧一批或半新半旧）：
      // 跳过本轮，等新一批全部就绪后 layersKey 变化会重新触发本 effect。
      if (loadedLayersKeyRef.current !== layersKey) return;
      const deferMusic = deferToMusicRef.current;
      const sounds = soundsRef.current;
      for (let i = 0; i < Math.min(L.length, sounds.length); i += 1) {
        const vol = Math.min(1, Math.max(0, L[i]!.volume));
        try {
          const s = sounds[i]!;
          if (!s.isLoaded) continue;
          if (vol <= 0 || deferMusic) {
            try {
              s.volume = vol;
              if (s.playing) s.pause();
            } catch {
              /* ignore */
            }
            continue;
          }
          if (
            pausedByRemoteRef.current ||
            getShellAudioInterrupted()
          ) {
            continue;
          }
          s.muted = false;
          s.volume = vol;
          if (!s.playing) s.play();
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, layers, deferToExclusiveMusic, mixWithVoice]);

  /** 安卓：定时把该播的环境音拉回 playing（防被系统误 pause）。混播模式下音乐/金句在播也继续保活。播经时停掉，少抢 JS。 */
  useEffect(() => {
    if (!active || Platform.OS !== "android" || deferToExclusiveMusic) return;
    const id = setInterval(() => {
      if (getShellAudioInterrupted()) return;
      if (pausedByRemoteRef.current || deferToMusicRef.current) return;
      if (getShellScriptureWantPlaying()) return;
      if (
        !mixWithVoiceRef.current &&
        (getShellMusicWantPlaying() || getShellVerseWantPlaying())
      ) {
        return;
      }
      const L = layersRef.current;
      const sounds = soundsRef.current;
      void (async () => {
        for (let i = 0; i < Math.min(L.length, sounds.length); i += 1) {
          const vol = Math.min(1, Math.max(0, L[i]!.volume));
          if (vol <= 0) continue;
          try {
            const s = sounds[i]!;
            if (!s.isLoaded) continue;
            if (!s.playing) {
              s.volume = vol;
              s.play();
            }
          } catch {
            /* ignore */
          }
        }
      })();
    }, 1000);
    return () => clearInterval(id);
  }, [active, layersKey, deferToExclusiveMusic]);

  /**
   * 锁屏会话：只开环境音时也挂前台服务 / Now Playing，避免关屏被系统掐掉。
   * 音乐或金句已占会话时不抢。
   */
  useEffect(() => {
    const media = systemMedia;
    const musicOrVerseOn = getShellMusicWantPlaying() || getShellVerseWantPlaying();
    const audible = active && layers.some((layer) => layer.volume > 0);
    if (
      !media?.enabled ||
      !audible ||
      deferToExclusiveMusic ||
      musicOrVerseOn
    ) {
      if (getShellAuxMediaOwner()?.id === AMBIENT_MEDIA_OWNER_ID) {
        setShellAuxMediaOwner(null);
        refreshShellMediaSession();
      }
      return;
    }

    const title = media.title.trim() || "AskBible.me";
    const artist = (media.artist ?? "AskBible.me").trim() || "AskBible.me";

    const buildPayload = (playing: boolean) => ({
      title,
      artist,
      album: "Ambient",
      artworkUri: getShellMediaSceneArtworkUri(),
      durationSec: 0,
      positionSec: 0,
      playing,
      kind: "ambient" as const,
    });

    const pauseAll = async () => {
      pausedByRemoteRef.current = true;
      for (const sound of soundsRef.current) {
        try {
          if (sound.isLoaded) sound.pause();
        } catch {
          /* ignore */
        }
      }
      if (!getShellMusicWantPlaying()) {
        syncShellMediaSessionExplicit(buildPayload(false));
      }
    };

    const yieldPlayback = async () => {
      for (const sound of soundsRef.current) {
        try {
          if (sound.isLoaded && sound.playing) sound.pause();
        } catch {
          /* ignore */
        }
      }
    };

    const resumeAll = async () => {
      pausedByRemoteRef.current = false;
      if (deferToMusicRef.current || getShellMusicWantPlaying()) return;
      const L = layersRef.current;
      const sounds = soundsRef.current;
      for (let i = 0; i < Math.min(L.length, sounds.length); i += 1) {
        const vol = Math.min(1, Math.max(0, L[i]!.volume));
        if (vol <= 0) continue;
        try {
          const s = sounds[i]!;
          if (!s.isLoaded) continue;
          s.volume = vol;
          if (!s.playing) s.play();
        } catch {
          /* ignore */
        }
      }
      if (!getShellMusicWantPlaying()) {
        syncShellMediaSessionExplicit(buildPayload(true));
      }
    };

    setShellAuxMediaOwner({
      id: AMBIENT_MEDIA_OWNER_ID,
      pause: () => void pauseAll(),
      yieldPlayback: () => void yieldPlayback(),
      resume: () => void resumeAll(),
      buildPayload: () => buildPayload(!pausedByRemoteRef.current),
    });
    let cancelled = false;
    void reshuffleShellMediaSceneArtwork().then(() => {
      if (cancelled || getShellMusicWantPlaying()) return;
      syncShellMediaSessionExplicit(buildPayload(!pausedByRemoteRef.current));
    });

    return () => {
      cancelled = true;
      if (getShellAuxMediaOwner()?.id === AMBIENT_MEDIA_OWNER_ID) {
        setShellAuxMediaOwner(null);
        refreshShellMediaSession();
      }
    };
  }, [
    active,
    layers,
    layersKey,
    deferToExclusiveMusic,
    systemMedia?.enabled,
    systemMedia?.title,
    systemMedia?.artist,
  ]);
}
