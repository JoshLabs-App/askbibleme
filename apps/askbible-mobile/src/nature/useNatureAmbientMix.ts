import { Audio, type AVPlaybackSource } from "expo-av";
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
function ambientSoundDownloadFirst(source: AVPlaybackSource): boolean {
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
): Promise<AVPlaybackSource | null> {
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
  const soundsRef = useRef<Audio.Sound[]>([]);
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
          const st = await sound.getStatusAsync();
          if (st.isLoaded && st.isPlaying) await sound.pauseAsync();
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
            const st = await sounds[i]!.getStatusAsync();
            if (!st.isLoaded) continue;
            await sounds[i]!.setVolumeAsync(vol);
            if (!st.isPlaying) await sounds[i]!.playAsync();
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
          const st = await sound.getStatusAsync();
          if (st.isLoaded && st.isPlaying) await sound.pauseAsync();
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
      await Promise.all(
        batch.map(async (s) => {
          try {
            await s.unloadAsync();
          } catch {
            /* ignore */
          }
        }),
      );
    }

    (async () => {
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
          const created = await Audio.Sound.createAsync(
            source,
            {
              shouldPlay: shouldAutoPlay,
              isLooping: true,
              volume: vol > 0 ? vol : 0,
              rate,
              shouldCorrectPitch: true,
              isMuted: false,
            },
            undefined,
            ambientSoundDownloadFirst(source),
          );
          if (disposed) {
            await created.sound.unloadAsync().catch(() => {});
            return;
          }
          const sound = created.sound;
          if (!deferMusic && !mixVoice && (!aux || aux.id === AMBIENT_MEDIA_OWNER_ID)) {
            await primeShellSoundPlayback(sound, { autoPlay: shouldAutoPlay });
          }
          try {
            await sound.setIsMutedAsync(false);
            await sound.setVolumeAsync(vol);
            if (shouldAutoPlay) {
              const st = await sound.getStatusAsync();
              if (st.isLoaded && !st.isPlaying) await sound.playAsync();
            } else {
              await sound.pauseAsync();
            }
          } catch {
            /* ignore */
          }
          if (rate !== 1) {
            try {
              await sound.setRateAsync(rate, true);
            } catch {
              /* ignore */
            }
          }
          soundsRef.current.push(sound);
        } catch (err) {
          console.warn("[ambient] load failed", layer.layerId, err);
        }
      }
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
          const st = await sound.getStatusAsync();
          if (st.isLoaded && st.isPlaying) await sound.pauseAsync();
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
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (cancelled) return;
        if (soundsRef.current.length > 0) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      if (cancelled) return;
      const deferMusic = deferToMusicRef.current;
      const sounds = soundsRef.current;
      for (let i = 0; i < Math.min(L.length, sounds.length); i += 1) {
        const vol = Math.min(1, Math.max(0, L[i]!.volume));
        try {
          const st = await sounds[i]!.getStatusAsync();
          if (!st.isLoaded) continue;
          if (vol <= 0 || deferMusic) {
            try {
              await sounds[i]!.setVolumeAsync(vol);
              if (st.isPlaying) await sounds[i]!.pauseAsync();
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
          await sounds[i]!.setIsMutedAsync(false);
          await sounds[i]!.setVolumeAsync(vol);
          if (!st.isPlaying) await sounds[i]!.playAsync();
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
            const st = await sounds[i]!.getStatusAsync();
            if (!st.isLoaded) continue;
            if (!st.isPlaying) {
              await sounds[i]!.setVolumeAsync(vol);
              await sounds[i]!.playAsync();
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
          const st = await sound.getStatusAsync();
          if (st.isLoaded) await sound.pauseAsync();
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
          const st = await sound.getStatusAsync();
          if (st.isLoaded && st.isPlaying) await sound.pauseAsync();
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
          const st = await sounds[i]!.getStatusAsync();
          if (!st.isLoaded) continue;
          await sounds[i]!.setVolumeAsync(vol);
          if (!st.isPlaying) await sounds[i]!.playAsync();
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
