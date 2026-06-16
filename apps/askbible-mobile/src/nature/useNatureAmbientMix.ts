import { Audio } from "expo-av";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  configureShellAudioMode,
  primeShellSoundPlayback,
  shellSoundDownloadFirst,
} from "../audio/shellAudioMode";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";

export type NatureAmbientLayer = {
  layerId: string;
  src: string;
  volume: number;
  assetModule?: number;
};

export const EMPTY_NATURE_AMBIENT_LAYERS: NatureAmbientLayer[] = [];

/**
 * 与网站 `NatureAmbientMixAudio` 类似：按场景混音多轨循环环境声（MP3 来自网络 URL）。
 * 当前 `resolveNaturePlayback` 不向视频页输出环境层；保留 hook 供日后用户开关打开时使用。
 * `layersKey` 须随场景 / 混音配置变化，以便卸载旧轨并加载新轨。
 */
export function useNatureAmbientMix(
  baseUrl: string,
  layers: NatureAmbientLayer[],
  layersKey: string,
  playbackRate: number,
  active: boolean,
) {
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const soundsRef = useRef<Audio.Sound[]>([]);

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
      const L = layersRef.current;
      if (!active || L.length === 0) {
        return;
      }

      try {
        await configureShellAudioMode();
      } catch {
        /* ignore */
      }

      if (disposed) return;

      const rate = Math.min(2, Math.max(0.5, playbackRate));

      for (const layer of L) {
        if (disposed) break;
        const uri = toAbsoluteUrl(baseUrl, layer.src);
        const source =
          typeof layer.assetModule === "number" ? layer.assetModule : uri ? { uri } : null;
        if (!source) continue;
        const vol = Math.min(1, Math.max(0, layer.volume));
        try {
          const sound = new Audio.Sound();
          await sound.loadAsync(
            source,
            {
              shouldPlay: true,
              isLooping: true,
              volume: vol,
              rate,
              shouldCorrectPitch: true,
              isMuted: false,
            },
            shellSoundDownloadFirst(source),
          );
          await primeShellSoundPlayback(sound);
          // `primeShellSoundPlayback` 会把音量兜底到 1，这里恢复目标混音音量。
          try {
            await sound.setVolumeAsync(vol);
          } catch {
            /* ignore */
          }
          if (disposed) {
            await sound.unloadAsync().catch(() => {});
            return;
          }
          if (rate !== 1) {
            try {
              await sound.setRateAsync(rate, true);
            } catch {
              /* ignore */
            }
          }
          soundsRef.current.push(sound);
        } catch {
          /* skip broken layer */
        }
      }
    })();

    return () => {
      disposed = true;
      void disposeAll();
    };
  }, [baseUrl, layersKey, playbackRate, active]);

  /** Duck / restore without unload; volume 0 时 pause 以省 CPU。 */
  useEffect(() => {
    const L = layersRef.current;
    if (!active || L.length === 0 || soundsRef.current.length === 0) return;
    void (async () => {
      const sounds = soundsRef.current;
      for (let i = 0; i < Math.min(L.length, sounds.length); i += 1) {
        const vol = Math.min(1, Math.max(0, L[i]!.volume));
        try {
          const st = await sounds[i]!.getStatusAsync();
          if (!st.isLoaded) continue;
          if (vol <= 0) {
            if (st.isPlaying) await sounds[i]!.pauseAsync();
            continue;
          }
          if (!st.isPlaying) await sounds[i]!.playAsync();
          await sounds[i]!.setVolumeAsync(vol);
        } catch {
          /* ignore */
        }
      }
    })();
  }, [active, layers]);

  /** 后台暂停环境音，回前台恢复，减少后台 CPU/解码消耗。 */
  useEffect(() => {
    if (!active) return;
    const sync = (state: AppStateStatus) => {
      const shouldPlay = state === "active";
      void (async () => {
        for (const sound of soundsRef.current) {
          try {
            const st = await sound.getStatusAsync();
            if (!st.isLoaded) continue;
            if (shouldPlay) {
              if (!st.isPlaying) await sound.playAsync();
            } else if (st.isPlaying) {
              await sound.pauseAsync();
            }
          } catch {
            /* ignore */
          }
        }
      })();
    };
    const sub = AppState.addEventListener("change", sync);
    return () => sub.remove();
  }, [active, layersKey]);
}
