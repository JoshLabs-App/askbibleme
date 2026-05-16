/** 自然场景分类（写入 `nature-settings.json` 的 `category` 字段） */
export const NATURE_SCENE_CATEGORIES = ["nature", "day", "night"] as const;

export type NatureSceneCategory = (typeof NATURE_SCENE_CATEGORIES)[number];

export const DEFAULT_NATURE_SCENE_CATEGORY: NatureSceneCategory = "nature";

export function parseNatureSceneCategory(raw: unknown): NatureSceneCategory {
  if (raw === "day" || raw === "night" || raw === "nature") return raw;
  return DEFAULT_NATURE_SCENE_CATEGORY;
}

export function natureSceneCategoryLabelKey(id: NatureSceneCategory): string {
  return `nature.sceneCategory.${id}`;
}
