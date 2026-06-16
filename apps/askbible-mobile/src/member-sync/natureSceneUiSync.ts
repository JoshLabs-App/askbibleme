import {
  readNatureActiveSceneId,
  readNatureLoopAllScenesEnabled,
  writeNatureActiveSceneId,
  writeNatureLoopAllScenesEnabled,
} from "../nature/natureActiveScenePrefs";
import {
  readNatureAmbientMasterVolume,
  readNatureAmbientSceneSlotId,
  writeNatureAmbientMasterVolume,
  writeNatureAmbientSceneSlotId,
} from "../nature/natureAmbientScenePrefs";

export type NatureSceneUiSyncBundle = {
  version: 1;
  activeSceneId: string | null;
  loopAllScenes: boolean;
  ambientSceneSlotId: string | null;
  ambientMasterVolume: number;
};

export async function readNatureSceneUiSyncBundle(): Promise<NatureSceneUiSyncBundle> {
  const [activeSceneId, loopAllScenes, ambientSceneSlotId, ambientMasterVolume] = await Promise.all([
    readNatureActiveSceneId(),
    readNatureLoopAllScenesEnabled(),
    readNatureAmbientSceneSlotId(),
    readNatureAmbientMasterVolume(),
  ]);
  return { version: 1, activeSceneId, loopAllScenes, ambientSceneSlotId, ambientMasterVolume };
}

export async function applyNatureSceneUiSyncBundle(bundle: NatureSceneUiSyncBundle): Promise<void> {
  if (bundle.version !== 1) return;
  if (bundle.activeSceneId) await writeNatureActiveSceneId(bundle.activeSceneId);
  await writeNatureLoopAllScenesEnabled(bundle.loopAllScenes);
  if (bundle.ambientSceneSlotId) await writeNatureAmbientSceneSlotId(bundle.ambientSceneSlotId);
  await writeNatureAmbientMasterVolume(bundle.ambientMasterVolume);
}
