export const CONTENT_CORRECTION_SCOPES = [
  "explore_article",
  "info_edition",
  "guide_edition",
] as const;

export type ContentCorrectionScope = (typeof CONTENT_CORRECTION_SCOPES)[number];

/** 用户端提报时附带的定位信息（Web / App 共用） */
export type ContentCorrectionSubmitContext = {
  scope: ContentCorrectionScope;
  articleSlug?: string;
  articleTitle?: string;
  bookId?: string;
  chapter?: number;
  roleId?: string | null;
  roleLabel?: string | null;
  publishedAt?: string | null;
};

export type ContentCorrectionRecord = {
  id: string;
  createdAt: string;
  message: string;
  email: string | null;
  locale: string | null;
  scope: ContentCorrectionScope;
  articleSlug: string | null;
  articleTitle: string | null;
  bookId: string | null;
  chapter: number | null;
  roleId: string | null;
  roleLabel: string | null;
  publishedAt: string | null;
  platform: string | null;
  appVersion: string | null;
  ip: string;
  ua: string | null;
};
