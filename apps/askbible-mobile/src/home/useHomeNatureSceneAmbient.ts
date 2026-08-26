import { useEffect, useMemo } from "react";
import { ambientScenePlaybackGain } from "../nature/ambientScenePlaybackGain";
import { BUNDLED_AMBIENT_SCENE_AUDIO } from "../nature/bundledAmbientSceneAudio";
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
    const hasBundled = typeof BUNDLED_AMBIENT_SCENE_AUDIO[activeAmbientSlotId] === "number";
    if (hasBundled || ambientClipById.has(activeAmbientSlotId)) return;
    setActiveAmbientSlotId("");
  }, [enabled, activeAmbientSlotId, ambientClipById, setActiveAmbientSlotId]);

  const activeAmbientLayer = useMemo(() => {
    if (!activeAmbientSlotId) return [];
    const assetModule = BUNDLED_AMBIENT_SCENE_AUDIO[activeAmbientSlotId];
    if (typeof assetModule !== "number") return [];
    // 场景基准衰减 × 人声/音乐 duck（30%）。
    const sceneGain = ambientScenePlaybackGain(activeAmbientSlotId);
    const duck =
      scriptureModeActive || voiceActive
        ? AMBIENT_WHILE_VOICE_GAIN
        : musicModeActive
          ? AMBIENT_WHILE_MUSIC_GAIN
          : 1;
    const gain = Math.max(0, Math.min(1, sceneGain * duck));
    return [
      {
        layerId: activeAmbientSlotId,
        src: `bundled://${activeAmbientSlotId}`,
        volume: gain,
        assetModule,
      },
    ];
  }, [activeAmbientSlotId, musicModeActive, scriptureModeActive, voiceActive]);

  const ambientLayersKey = useMemo(
    // 勿把 volume 写进 key：开播压音时勿整轨重建（会掐主曲）。
    // 压音改走 useNatureAmbientMix 的 duck 副作用。
    () =>
      activeAmbientLayer
        .map((layer) => `${layer.layerId}:${layer.assetModule ?? layer.src}`)
        .join("|"),
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
