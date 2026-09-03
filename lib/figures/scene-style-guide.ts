/** 所有场景配图/人物形象共用的核心风格锁,逐字复用,不要按章节改写措辞。
 * 踩过的坑:
 * - "cinematic 3D animation / feature-film" 类措辞会把模型带向光滑写实 CGI,应避免。
 * - "hand-painted / traditional painting / illustration" 类措辞会把画面拉成扁平插画,
 *   且构图容易变成"角色设定图"而不是"电影镜头"。
 * - 色板描述里不能出现 "muted / dusty" 这类词,会让整体颜色发灰。
 * - 人物比例描述要写死"卡通化、五官夸张",不要写"natural proportions / subtle
 *   stylization"这种弱化措辞,否则又会被拉回写实人体比例。 */
const CORE_STYLE =
  "Mature stylized 3D biblical animation — clearly an animated character design, not a " +
  "realistic human. Characters have large expressive eyes, strong simplified eyebrows, " +
  "clear stylized noses, stylized mouths, distinctive facial silhouettes, and simplified, " +
  "slightly elongated body proportions — an appealing designed character, not natural human " +
  "anatomy. Soft rounded forms. Use soft painterly textures with dimensional 3D shading. " +
  "Matte surfaces, not glossy. The characters must be instantly readable as animated " +
  "characters at a glance, the way a Pixar/DreamWorks-caliber character would be, never " +
  "mistakable for a real photographed person. Warm, richly saturated earthy colors — " +
  "vibrant and colorful like a beautifully animated film, NOT washed-out, NOT desaturated, " +
  "NOT dull or grayish. Ancient Near Eastern biblical world. " +
  "NOT a realistic photograph, NOT live action, NOT photorealistic, NOT photorealistic CGI, " +
  "NOT glossy CGI, NOT realistic skin texture or pores, NOT natural human proportions, " +
  "NOT anime, NOT manga, NOT children's cartoon, NOT exaggerated comedy.";

/** 章节场景配图(ChapterScene)专用:电影镜头构图,不是人物设定图 */
export const SCENE_ILLUSTRATION_STYLE_PROMPT =
  "Create a vertical 9:16 cinematic scene from a mature biblical animated film.\n\n" +
  "VISUAL STYLE:\n" +
  CORE_STYLE +
  " Warm golden sunlight, soft atmospheric haze, painterly mountains and desert, layered " +
  "foreground/middle ground/background. The result should feel like a frame taken directly " +
  "from a serious, mature animated biblical feature film — NOT a character portrait, NOT a " +
  "character sheet, NOT a concept-art portrait. No text, no subtitles, no borders, no watermark.";

/**
 * 出场人物若带参考图,必须附上这段说明:参考图只锁定人物身份(脸/发型/胡须/肤色/
 * 服装/比例),不要照抄参考图本身的构图/背景/姿势/打光——否则场景图会被参考图的
 * "角色设定图"呈现方式带偏,变成一张放大的人物卡而不是电影镜头。
 */
export function referenceImageIdentityOnlyNote(characterLabel: string): string {
  return (
    `IMPORTANT: The supplied ${characterLabel} reference image is ONLY a character ` +
    "reference. Use it to preserve the character's face shape, hairstyle, beard, skin tone, " +
    "clothing design, colors, body proportions and overall character identity. Do NOT copy " +
    "the reference image's pose, composition, background, lighting, framing, or " +
    "character-sheet presentation. Transform the character into the scene described below, " +
    "rendered with the same stylized (not realistic) character design language."
  );
}

/** 人物库锚点像(FigureVisualProfile 参考图)专用:博物馆肖像式直视观众构图 + 透明底 */
export const CHARACTER_PORTRAIT_STYLE_PROMPT =
  "CHARACTER PORTRAIT for a mature biblical animated film, museum-portrait presentation, " +
  "isolated character cutout.\n\n" +
  "VISUAL STYLE:\n" +
  CORE_STYLE +
  "\n\nCOMPOSITION: full body standing pose, natural relaxed stance, but the head and eyes " +
  "are turned directly toward the viewer — direct eye contact, as if the character is " +
  "quietly looking at and addressing the person viewing the portrait, the way a dignified " +
  "museum portrait painting seems to follow and engage the viewer. Warm, sincere, gently " +
  "present expression — not smiling broadly, not stern, simply present and attentive. " +
  "Character design sheet clarity for clothing and proportions, but with this direct-gaze " +
  "portrait quality rather than a generic side-facing turnaround pose. Isolated on a plain " +
  "background with no scenery, just the character. Vertical 3:4 crop. No text, no watermark.";
