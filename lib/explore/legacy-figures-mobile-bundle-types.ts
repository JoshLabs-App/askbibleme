export type MobileLegacyFigureEnBlock = {
  displayName: string;
  scripturePersonality?: string;
  periodLabel?: string;
  lifespan?: string;
  characterRole?: string;
  article?: {
    title: string;
    summary: string;
    body: string;
  };
};

export type MobileLegacyFigureArticle = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  authorName?: string;
  updatedAt?: string;
};

export type MobileLegacyFigureProfile = {
  id: string;
  slug: string;
  displayNameZh: string;
  englishName?: string;
  characterRoleZh?: string;
  scripturePersonalityZh?: string;
  periodLabelZh?: string;
  lifespanZh?: string;
  linkedArticleSlug?: string;
  profileStatus?: string;
  article: MobileLegacyFigureArticle | null;
  en?: MobileLegacyFigureEnBlock | null;
};

export type MobileLegacyFigureTimelineEntry = {
  id: string;
  slug: string;
  displayNameZh: string;
  englishName?: string;
  characterRoleZh?: string;
  linkedArticleSlug?: string;
  profileStatus?: string;
  articleTitle?: string | null;
  article: null;
};

export type MobileLegacyFigureBookRow = {
  bookNumber: number;
  bookId: string;
  testament: "old" | "new";
  eraCompact: string;
  eraAria: string;
  figures: MobileLegacyFigureTimelineEntry[];
};

export type MobileLegacyFiguresBundle = {
  schemaVersion: number;
  contentVersion?: string;
  profiles: MobileLegacyFigureProfile[];
  bookRows: MobileLegacyFigureBookRow[];
};

export function isMobileLegacyFiguresBundle(raw: unknown): raw is MobileLegacyFiguresBundle {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Partial<MobileLegacyFiguresBundle>;
  if (o.schemaVersion !== 2 || !Array.isArray(o.profiles) || !Array.isArray(o.bookRows)) return false;
  return o.profiles.length > 0 && o.bookRows.length > 0;
}
