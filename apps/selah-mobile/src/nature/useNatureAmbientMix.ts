import { Audio } from "expo-av";
import { useEffect, useRef } from "react";
import { toAbsoluteUrl } from "../config/selahBaseUrl";

export type NatureAmbientLayer = { layerId: string; src: string; volume: number };

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

  useEffect(() => {
    let disposed = false;
    const sounds: Audio.Sound[] = [];

    async function disposeAll() {
      await Promise.all(
        sounds.splice(0).map(async (s) => {
          try {
            await s.unloadAsync();
          } catch {
            /* ignore */
          }
        }),
      );
    }

    (async () => {
      const L = layersRef.current;
      if (!active || L.length === 0) {
        return;
      }

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch {
        /* ignore */
      }

      if (disposed) return;

      const rate = Math.min(2, Math.max(0.5, playbackRate));

      for (const layer of L) {
        if (disposed) break;
        const uri = toAbsoluteUrl(baseUrl, layer.src);
        if (!uri) continue;
        const vol = Math.min(1, Math.max(0, layer.volume));
        try {
          const sound = new Audio.Sound();
          await sound.loadAsync(
            { uri },
            {
              shouldPlay: true,
              isLooping: true,
              volume: vol,
              rate,
              shouldCorrectPitch: true,
            },
            false,
          );
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
          sounds.push(sound);
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
}
