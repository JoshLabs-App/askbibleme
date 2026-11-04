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

/** 与原生场景一致；只有用户已开启环境音时才跟随。 */
export const SCENE_DEFAULT_AMBIENT: Record<string, NatureAmbientSceneSlotId> = {
  "9cc949f2-3c1d-49c0-8357-2dc1d32bd954": "scene-water",
  "3c8150de-7baa-4334-9c89-4042781ced66": "scene-rain",
  "7536456b-50fe-42c0-ad70-e78c9710e762": "scene-wind",
  "d721567f-395f-41d0-b022-7f78a4ef456e": "scene-wind",
  "d86754f9-2c16-4896-a00f-31a29858b547": "scene-white-noise",
  "3ebc424b-5a1b-48dd-accb-0906186dfda0": "scene-birds",
  "c6eed3e9-7b57-4fd8-9843-4af6fb321b0c": "scene-rain",
  "260b958e-f95a-4900-80b5-3ae9e7b2d720": "scene-white-noise",
  "8132b70e-f9dc-44a3-9cb0-35f43a46ef33": "scene-water",
};
