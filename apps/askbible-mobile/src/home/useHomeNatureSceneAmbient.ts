import { useEffect, useMemo } from "react";
import { ambientScenePlaybackGain } from "../nature/ambientScenePlaybackGain";
import {
  isAmbientSceneSlotAvailable,
  markAmbientSceneAudioActiveUri,
  peekAmbientSceneAudioSrc,
  warmAmbientSceneAudioCache,
} from "../nature/ambientSceneAudioSource";
import {
  NATURE_AMBIENT_SCENE_SLOTS,
  type NatureAmbientSceneSlotId,
} from "../nature/ambientSceneSlots";
import { useNatureAmbientMix } from "../nature/useNatureAmbientMix";
import { useLocale } from "../i18n/LocaleProvider";
import type { NatureSettingsV2 } from "../types/nature";

/** 金句 / TTS / 壳层读经进行时，环境音保持可听但压到 30%。 */
export const AMBIENT_WHILE_VOICE_GAIN = 0.3;
/** 音乐优先混播：环境音压到 30%（与人声 duck 同级）。 */
export const AMBIENT_WHILE_MUSIC_GAIN = 0.3;

type Args = {
  settings: NatureSettingsV2 | null;
  activeAmbientSlotId: NatureAmbientSceneSlotId | "";
  setActiveAmbientSlotId: React.Dispatch<React.SetStateAction<NatureAmbientSceneSlotId | "">>;
  clampedRate: number;
  musicModeActive: boolean;
  scriptureModeActive: boolean;
  voiceActive: boolean;
  enabled?: boolean;
};

export function useHomeNatureSceneAmbient({
  settings,
  activeAmbientSlotId,
  setActiveAmbientSlotId,
  clampedRate,
  musicModeActive,
  scriptureModeActive,
  voiceActive,
  enabled = true,
}: Args) {
  const { locale } = useLocale();
  const ambientClipById = useMemo(
    () => new Map((settings?.ambientClips ?? []).map((clip) => [clip.id, clip])),
    [settings?.ambientClips],
  );

  useEffect(() => {
    if (!enabled) return;
    if (!activeAmbientSlotId) return;
    if (isAmbientSceneSlotAvailable(activeAmbientSlotId) || ambientClipById.has(activeAmbientSlotId)) {
      return;
    }
    setActiveAmbientSlotId("");
  }, [enabled, activeAmbientSlotId, ambientClipById, setActiveAmbientSlotId]);

  const activeAmbientLayer = useMemo(() => {
    if (!activeAmbientSlotId) return [];
    if (!isAmbientSceneSlotAvailable(activeAmbientSlotId)) return [];
    // 场景基准衰减 × 人声/音乐 duck（30%）。
    const sceneGain = ambientScenePlaybackGain(activeAmbientSlotId);
    const duck =
      scriptureModeActive || voiceActive
        ? AMBIENT_WHILE_VOICE_GAIN
        : musicModeActive
          ? AMBIENT_WHILE_MUSIC_GAIN
          : 1;
    const gain = Math.max(0, Math.min(1, sceneGain * duck));
    // 内存里已缓存过就直接给本地文件；否则先给 R2 直链即时播放，同时后台把它下下来，
    // 下次选同一个场景直接吃本地缓存，不必再等网络（也不会因为流式而卡顿）。
    const src = peekAmbientSceneAudioSrc(activeAmbientSlotId);
    markAmbientSceneAudioActiveUri(src);
    warmAmbientSceneAudioCache(activeAmbientSlotId);
    return [
      {
        layerId: activeAmbientSlotId,
        src,
        volume: gain,
      },
    ];
  }, [activeAmbientSlotId, musicModeActive, scriptureModeActive, voiceActive]);

  const ambientLayersKey = useMemo(
    // 勿把 volume 写进 key：开播压音时勿整轨重建（会掐主曲）。
    // 压音改走 useNatureAmbientMix 的 duck 副作用。
    () =>
      activeAmbientLayer.map((layer) => `${layer.layerId}:${layer.src}`).join("|"),
    [activeAmbientLayer],
  );

  const ambientTitle = useMemo(() => {
    const slot = NATURE_AMBIENT_SCENE_SLOTS.find((item) => item.id === activeAmbientSlotId);
    if (!slot) return "AskBible.me";
    return locale === "en" ? slot.labelEn : slot.label;
  }, [activeAmbientSlotId, locale]);

  const shellOwnsMedia = musicModeActive || scriptureModeActive || voiceActive;
  // 音乐 / 金句 / 读经与环境音可两路混播；三路同时时由 homeGoldenVerseTwoSourceMutex 互斥。
  const mixAmbientWithForeground = musicModeActive || scriptureModeActive || voiceActive;

  useNatureAmbientMix(
    "",
    activeAmbientLayer,
    ambientLayersKey,
    clampedRate,
    // 冷启动由 load 按场景默认/存档打开；跨 Tab 由 mix 保持。
    enabled && activeAmbientLayer.length > 0,
    {
      enabled: !shellOwnsMedia,
      title: ambientTitle,
      artist: "AskBible.me",
    },
    false,
    mixAmbientWithForeground,
  );
}
