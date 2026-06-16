/** 时间轴列表所需字段；正文在详情页单独读取。 */
export type LegacyFigureTimelineEntry = {
  id: string;
  slug: string;
  displayNameZh: string;
  englishName: string;
  characterRoleZh: string;
  linkedArticleSlug: string;
  profileStatus: string;
  articleTitle: string | null;
};

export type LegacyFigureTimelineBookRow = {
  bookNumber: number;
  bookId: string;
  testament: "old" | "new";
  eraCompact: string;
  eraAria: string;
  figures: LegacyFigureTimelineEntry[];
};

export type LegacyFiguresTimelineBundle = {
  schemaVersion: number;
  contentVersion: string;
  bookRows: LegacyFigureTimelineBookRow[];
};
