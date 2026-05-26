export const NATURE_AMBIENT_SCENE_SLOTS = [
  { id: "scene-water", label: "水" },
  { id: "scene-rain", label: "雨" },
  { id: "scene-waves", label: "海浪" },
  { id: "scene-thunder", label: "雷" },
  { id: "scene-birds", label: "鸟" },
  { id: "scene-wind", label: "风" },
  { id: "scene-white-noise", label: "白噪音" },
  { id: "scene-cafe", label: "咖啡厅" },
] as const;

export type NatureAmbientSceneSlotId = (typeof NATURE_AMBIENT_SCENE_SLOTS)[number]["id"];

export function natureAmbientSceneSlotLabel(id: string): string {
  return NATURE_AMBIENT_SCENE_SLOTS.find((slot) => slot.id === id)?.label ?? id;
}
