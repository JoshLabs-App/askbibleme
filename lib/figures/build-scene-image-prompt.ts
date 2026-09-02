import type { ChapterScene, FigureVisualProfileBundle } from "./types";
import { SCENE_ILLUSTRATION_STYLE_PROMPT } from "./scene-style-guide";

function findStage(bundle: FigureVisualProfileBundle, slug: string, stageId: string) {
  const profile = bundle.profiles.find((p) => p.slug === slug);
  return profile?.stages.find((s) => s.stageId === stageId) ?? null;
}

/**
 * 拼装最终喂给图像模型的 prompt:风格锁 + 每个出场人物的外貌/服饰设定 + 场景构图。
 * 人物外貌只在人物库里写一份,这里统一拼装,避免每格场景各自重复描述导致长相漂移。
 */
export function buildSceneImagePrompt(
  scene: ChapterScene,
  visualProfiles: FigureVisualProfileBundle,
): string {
  const characterBlocks = scene.charactersInScene.map((ref) => {
    const stage = findStage(visualProfiles, ref.slug, ref.stageId);
    if (!stage) return `${ref.slug} (${ref.stageId}): visual profile missing`;
    const marks = stage.distinguishingMarksZh ? ` ${stage.distinguishingMarksZh}.` : "";
    return `${ref.slug}: ${stage.appearanceZh}. ${stage.clothingZh}.${marks}`;
  });

  return [
    SCENE_ILLUSTRATION_STYLE_PROMPT,
    ...characterBlocks,
    `Setting: ${scene.settingZh}`,
    `Composition: ${scene.imagePrompt}`,
  ].join("\n");
}
