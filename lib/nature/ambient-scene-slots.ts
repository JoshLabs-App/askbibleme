export const NATURE_AMBIENT_SCENE_SLOTS = [
  // 有场景默认绑定的排前（与 mobile ambientSceneSlots 对齐）
  { id: "scene-water", label: "水", labelEn: "Water", icon: "water" },
  { id: "scene-rain", label: "雨", labelEn: "Rain", icon: "weather-rainy" },
  { id: "scene-birds", label: "鸟", labelEn: "Birds", icon: "bird" },
  { id: "scene-white-noise", label: "白噪音", labelEn: "White Noise", icon: "radio-tower" },
  { id: "scene-wind", label: "风", labelEn: "Wind", icon: "weather-windy" },
  { id: "scene-fire", label: "火", labelEn: "Fire", icon: "fire" },
  { id: "scene-waves", label: "海浪", labelEn: "Waves", icon: "waves" },
  { id: "scene-thunder", label: "雷", labelEn: "Thunder", icon: "weather-lightning" },
  { id: "scene-cafe", label: "咖啡厅", labelEn: "Cafe", icon: "coffee" },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  labelEn: string;
  icon: string;
}>;

export type NatureAmbientSceneSlotId = (typeof NATURE_AMBIENT_SCENE_SLOTS)[number]["id"];

export function natureAmbientSceneSlotLabel(id: string): string {
  return NATURE_AMBIENT_SCENE_SLOTS.find((slot) => slot.id === id)?.label ?? id;
}
