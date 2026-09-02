export type FigureScriptureRef = {
  bookId: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
};

export type FigureScriptureSubGroup = {
  id: string;
  titleZh: string;
  titleEn?: string;
  refs: FigureScriptureRef[];
  defaultExpanded?: boolean;
};

export type FigureReadWholeChapter = {
  bookId: string;
  chapter: number;
  labelZh: string;
  labelEn?: string;
};

export type FigureScriptureGroup = {
  id: string;
  titleZh: string;
  titleEn?: string;
  explainZh: string;
  explainEn?: string;
  refs: FigureScriptureRef[];
  noteZh?: string;
  noteEn?: string;
  defaultExpanded?: boolean;
  readWholeChapter?: FigureReadWholeChapter;
  subGroups?: FigureScriptureSubGroup[];
};

/** 人物页末尾：贯穿一生的正统神学梳理（无经文块，默认展示） */
export type FigureSynthesisSection = {
  titleZh: string;
  titleEn?: string;
  introZh?: string;
  introEn?: string;
  pointsZh: string[];
  pointsEn?: string[];
};

export type FigurePageContent = {
  slug: string;
  displayNameZh: string;
  englishName: string;
  periodLabelZh?: string;
  periodLabelEn?: string;
  primaryBookId: string;
  introZh: string;
  introEn?: string;
  scriptureGroups: FigureScriptureGroup[];
  synthesisSection?: FigureSynthesisSection;
  relatedFigureSlugs?: string[];
};

export type FigureRegistryEntry = {
  slug: string;
  displayNameZh: string;
  englishName: string;
  primaryBookId: string;
  periodLabelZh?: string;
  periodLabelEn?: string;
  contentPath: string;
};

export type FigureRegistry = {
  schemaVersion: number;
  figures: FigureRegistryEntry[];
};

export type FiguresBundle = {
  schemaVersion: number;
  contentVersion?: string;
  figures: FigurePageContent[];
};

/** 人物在某一人生阶段的视觉设定,供场景配图 prompt 拼装与参考图使用 */
export type FigureAppearanceStage = {
  stageId: string;
  ageRangeLabelZh?: string;
  appearanceZh: string;
  clothingZh: string;
  distinguishingMarksZh?: string;
  /** 该阶段的标准参考图(生成后回填),供后续场景生成时作为参考锁定长相 */
  referenceImageAssetId?: string;
};

export type FigureVisualProfile = {
  slug: string;
  stages: FigureAppearanceStage[];
};

export type FigureVisualProfileBundle = {
  schemaVersion: number;
  profiles: FigureVisualProfile[];
};

export type SceneCharacterRef = {
  slug: string;
  stageId: string;
};

/** 一章拆解出的一格场景配图 */
export type ChapterScene = {
  order: number;
  titleZh: string;
  verseRef: FigureScriptureRef;
  charactersInScene: SceneCharacterRef[];
  settingZh: string;
  /** 仅描述该场景独有的构图/动作,不重复风格与人物外貌(由 buildSceneImagePrompt 统一拼装) */
  imagePrompt: string;
  assetId?: string;
  status: "draft" | "generated" | "approved";
};

export type ChapterSceneBundle = {
  schemaVersion: number;
  bookId: string;
  chapter: number;
  scenes: ChapterScene[];
};
