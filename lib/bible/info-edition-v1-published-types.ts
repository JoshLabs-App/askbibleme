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

export type InfoEditionV1PublishedFile = {
  version: typeof INFO_EDITION_V1_PUBLISHED_VERSION;
  /** 前台默认展示：基础版 */
  defaultRoleId: string;
  /** 前台默认展示：DeepSeek 网关 */
  defaultProfileId: string;
  chapters: Record<string, InfoEditionV1PublishedChapter>;
};
