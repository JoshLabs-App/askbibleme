export const NATURE_AMBIENT_SCENE_SLOTS = [
  // 有场景默认绑定的排前
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

/** 用户点选场景时默认打开的环境音（循环自动切景不触发）。 */
export const NATURE_SCENE_DEFAULT_AMBIENT: Partial<
  Record<string, NatureAmbientSceneSlotId>
> = {
  // 雪山湖 → 水
  "9cc949f2-3c1d-49c0-8357-2dc1d32bd954": "scene-water",
  // 雨夜城 → 雨
  "3c8150de-7baa-4334-9c89-4042781ced66": "scene-rain",
  // 雾林 → 鸟
  "3ebc424b-5a1b-48dd-accb-0906186dfda0": "scene-birds",
  // 云海 → 风
  "7536456b-50fe-42c0-ad70-e78c9710e762": "scene-wind",
  // 层峦 → 风
  "d721567f-395f-41d0-b022-7f78a4ef456e": "scene-wind",
  // 晨光 → 白噪音
  "d86754f9-2c16-4896-a00f-31a29858b547": "scene-white-noise",
  // 雨窗 → 雨
  "c6eed3e9-7b57-4fd8-9843-4af6fb321b0c": "scene-rain",
  // 晨读 → 白噪音
  "260b958e-f95a-4900-80b5-3ae9e7b2d720": "scene-white-noise",
  // 暮湖 → 水
  "8132b70e-f9dc-44a3-9cb0-35f43a46ef33": "scene-water",
};

/** 英文界面下的场景名（配置里 `title` 目前只有中文）。 */
export const NATURE_SCENE_TITLE_EN: Record<string, string> = {
  "9cc949f2-3c1d-49c0-8357-2dc1d32bd954": "Snow Lake",
  "3c8150de-7baa-4334-9c89-4042781ced66": "Rain City",
  "7536456b-50fe-42c0-ad70-e78c9710e762": "Cloud Sea",
  "d721567f-395f-41d0-b022-7f78a4ef456e": "Ridges",
  "d86754f9-2c16-4896-a00f-31a29858b547": "Dawn",
  "3ebc424b-5a1b-48dd-accb-0906186dfda0": "Mist Forest",
  "c6eed3e9-7b57-4fd8-9843-4af6fb321b0c": "Rain Window",
  "260b958e-f95a-4900-80b5-3ae9e7b2d720": "Morning",
  "8132b70e-f9dc-44a3-9cb0-35f43a46ef33": "Dusk Lake",
};

/** 打开 App：不自动带环境音。只有用户点选场景才跟场景默认。 */
export function resolveColdStartAmbientSlot(
  _sceneId: string,
  _storedAmbient?: string | null,
): NatureAmbientSceneSlotId | "" {
  return "";
}
