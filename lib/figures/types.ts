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
