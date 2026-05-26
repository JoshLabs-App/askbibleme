export type InfoEditionReaderVariant = "info" | "guide";

export type InfoEditionV1PublishedChapter = {
  bookId: string;
  chapter: number;
  roleId: string;
  roleLabel: string;
  profileId: string;
  profileName: string;
  markdown: string;
  charCount: number;
  publishedAt: string;
};

export type InfoEditionCacheStatus = "ready" | "pending" | "failed" | "missing";

export type InfoEditionReaderCachePayload = {
  ok?: boolean;
  status?: InfoEditionCacheStatus;
  published?: InfoEditionV1PublishedChapter;
  error?: string;
  message?: string;
};
