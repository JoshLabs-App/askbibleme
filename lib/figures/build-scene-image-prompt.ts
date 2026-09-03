import type { ChapterScene, FigureAppearanceStage, FigureVisualProfileBundle } from "./types";
import { SCENE_ILLUSTRATION_STYLE_PROMPT, referenceImageIdentityOnlyNote } from "./scene-style-guide";

function findStage(bundle: FigureVisualProfileBundle, slug: string, stageId: string) {
  const profile = bundle.profiles.find((p) => p.slug === slug);
  return profile?.stages.find((s) => s.stageId === stageId) ?? null;
}

export type SceneImagePromptResult = {
  prompt: string;
  /** 有锚点参考图的出场人物,调用图像 API 时应作为 edits 接口的输入图一并传入 */
  referenceImageAssetIds: string[];
};

/**
 * 拼装最终喂给图像模型的 prompt:风格锁 + 每个出场人物的外貌/服饰设定 + 场景构图。
 * 人物外貌只在人物库里写一份,这里统一拼装,避免每格场景各自重复描述导致长相漂移。
 * 有参考图的人物会额外带上"参考图只锁身份、别照抄构图"的说明,防止场景图被参考图
 * 的呈现方式(角色设定图/静态站姿)带偏。
 */
export function buildSceneImagePrompt(
  scene: ChapterScene,
  visualProfiles: FigureVisualProfileBundle,
): SceneImagePromptResult {
  const stages: { slug: string; stage: FigureAppearanceStage }[] = [];
  const characterBlocks: string[] = [];
  const identityNotes: string[] = [];
  const referenceImageAssetIds: string[] = [];

  for (const ref of scene.charactersInScene) {
    const stage = findStage(visualProfiles, ref.slug, ref.stageId);
    if (!stage) {
      characterBlocks.push(`${ref.slug} (${ref.stageId}): visual profile missing`);
      continue;
    }
    stages.push({ slug: ref.slug, stage });
    const marks = stage.distinguishingMarksZh ? ` ${stage.distinguishingMarksZh}.` : "";
    characterBlocks.push(`${ref.slug}: ${stage.appearanceZh}. ${stage.clothingZh}.${marks}`);
    if (stage.referenceImageAssetId) {
      identityNotes.push(referenceImageIdentityOnlyNote(ref.slug));
      referenceImageAssetIds.push(stage.referenceImageAssetId);
    }
  }

  const prompt = [
    SCENE_ILLUSTRATION_STYLE_PROMPT,
    ...identityNotes,
    ...characterBlocks,
    `Setting: ${scene.settingZh}`,
    `Composition: ${scene.imagePrompt}`,
  ].join("\n\n");

  return { prompt, referenceImageAssetIds };
}
