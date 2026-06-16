export type ContentCorrectionScope = "explore_article" | "info_edition" | "guide_edition";

export type ContentCorrectionContext = {
  scope: ContentCorrectionScope;
  articleSlug?: string;
  articleTitle?: string;
  bookId?: string;
  chapter?: number;
  roleId?: string | null;
  roleLabel?: string | null;
  publishedAt?: string | null;
};
