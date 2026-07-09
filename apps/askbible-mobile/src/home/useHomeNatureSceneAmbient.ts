import { useEffect, useMemo } from "react";
import { BUNDLED_AMBIENT_SCENE_AUDIO } from "../nature/bundledAmbientSceneAudio";
import type { NatureAmbientSceneSlotId } from "../nature/ambientSceneSlots";
import { useNatureAmbientMix } from "../nature/useNatureAmbientMix";
import type { NatureSettingsV2 } from "../types/nature";

type Args = {
  homeFocused: boolean;
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
  homeFocused,
  settings,
  activeAmbientSlotId,
  setActiveAmbientSlotId,
  clampedRate,
  musicModeActive,
  scriptureModeActive,
  voiceActive,
  enabled = true,
}: Args) {
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
    const gain = scriptureModeActive
      ? 0
      : voiceActive
        ? 0.03
        : musicModeActive
          ? 0.2
          : 1;
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
    () => activeAmbientLayer.map((layer) => `${layer.layerId}:${layer.src}`).join("|"),
    [activeAmbientLayer],
  );

  useNatureAmbientMix(
    "",
    activeAmbientLayer,
    ambientLayersKey,
    clampedRate,
    enabled && homeFocused && activeAmbientLayer.length > 0,
  );
}
