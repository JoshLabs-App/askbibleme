import { readNatureHomeActiveSceneId, writeNatureHomeActiveSceneId } from "@/lib/home/nature-home-active-scene-prefs";
import {
  readNatureHomeLoopAllScenesEnabled,
  writeNatureHomeLoopAllScenesEnabled,
} from "@/lib/home/nature-home-loop-all-scenes-prefs";
import {
  readNatureHomeAmbientSceneSlotId,
  writeNatureHomeAmbientSceneSlotId,
} from "@/lib/home/nature-home-ambient-scene-prefs";

export type NatureSceneUiSyncBundle = {
  version: 1;
  activeSceneId: string | null;
  loopAllScenes: boolean;
  ambientSceneSlotId: string | null;
  /** Web 暂无独立音量控件；保留字段以便与 App 合并 */
  ambientMasterVolume: number;
};

export function readNatureSceneUiSyncBundle(): NatureSceneUiSyncBundle {
  return {
    version: 1,
    activeSceneId: readNatureHomeActiveSceneId(),
    loopAllScenes: readNatureHomeLoopAllScenesEnabled(),
    ambientSceneSlotId: readNatureHomeAmbientSceneSlotId(),
    ambientMasterVolume: 1,
  };
}

export function applyNatureSceneUiSyncBundle(bundle: NatureSceneUiSyncBundle): void {
  if (bundle.version !== 1 || typeof window === "undefined") return;
  if (bundle.activeSceneId) writeNatureHomeActiveSceneId(bundle.activeSceneId);
  writeNatureHomeLoopAllScenesEnabled(bundle.loopAllScenes);
  if (bundle.ambientSceneSlotId) writeNatureHomeAmbientSceneSlotId(bundle.ambientSceneSlotId);
}
