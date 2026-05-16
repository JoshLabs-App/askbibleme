export const INFO_EDITION_V1_PUBLISHED_VERSION = 1 as const;

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

export type InfoEditionV1ChapterCacheStatus = "ready" | "pending" | "failed" | "missing";

export type InfoEditionV1PendingChapter = {
  bookId: string;
  chapter: number;
  startedAt: string;
};

export type InfoEditionV1FailedChapter = {
  bookId: string;
  chapter: number;
  error: string;
  failedAt: string;
};

export type InfoEditionV1PublishedFile = {
  version: typeof INFO_EDITION_V1_PUBLISHED_VERSION;
  /** 前台默认展示：基础版 */
  defaultRoleId: string;
  /** 前台默认展示：DeepSeek 网关 */
  defaultProfileId: string;
  chapters: Record<string, InfoEditionV1PublishedChapter>;
  /** 用户点击「查看相关信息」后正在生成 */
  pending?: Record<string, InfoEditionV1PendingChapter>;
  failed?: Record<string, InfoEditionV1FailedChapter>;
};
