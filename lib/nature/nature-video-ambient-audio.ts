import type { NatureAmbientClipEntry, NatureVideoMixLayer } from "./types";

/**
 * When `false`, nature **video** surfaces do not play layered ambient audio from `nature-settings.json` mix.
 * Future: read a user-facing preference (localStorage / account) and set this at runtime or branch in callers.
 */
export const NATURE_VIDEO_AMBIENT_AUDIO_ENABLED = false;

export type NatureAmbientPlaybackLayer = {
  layerId: string;
  src: string;
  volume: number;
};

export function buildNatureAmbientPlaybackLayers(
  clips: NatureAmbientClipEntry[] | undefined,
  mix: NatureVideoMixLayer[] | undefined,
): NatureAmbientPlaybackLayer[] {
  const clipById = new Map((clips ?? []).map((c) => [c.id, c]));
  return (mix ?? [])
    .map((layer) => {
      const clip = clipById.get(layer.clipId);
      const src = clip?.src.trim() ?? "";
      if (!src) return null;
      return { layerId: layer.id, src, volume: layer.volume };
    })
    .filter((x): x is NatureAmbientPlaybackLayer => x !== null);
}
