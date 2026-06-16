import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";

export const INFO_EDITION_V3_STORE_VERSION = 1 as const;
export const INFO_EDITION_V3_HISTORY_MAX = 48;
export const INFO_EDITION_V3_MAX_COMPARE_RUNS = 12;

export type InfoEditionV3Draft = {
  bookId: string;
  chapter: number;
  /** 人工补充说明，会一并送入批判/修订 pass */
  editorNotes: string;
  /** 修订 pass 使用的批判正文（可粘贴，或从上次批判结果选用） */
  critiqueText: string;
  selectedProfileIds: string[];
  selectedGenerationRoleIds: string[];
};

export type InfoEditionV3EntryKind = "compare" | "draft";

export type InfoEditionV3HistoryEntry = InfoEditionV3Draft & {
  id: string;
  savedAt: string;
  editorNotesCharCount: number;
  critiqueCharCount: number;
  entryKind?: InfoEditionV3EntryKind;
  generations?: InfoEditionV1Generation[];
  generatedAt?: string;
};

export type InfoEditionV3Workspace = {
  version: typeof INFO_EDITION_V3_STORE_VERSION;
  current: InfoEditionV3Draft;
  history: InfoEditionV3HistoryEntry[];
};

export type InfoEditionV3PublishedSource = {
  roleId: string;
  roleLabel: string;
  markdown: string;
  charCount: number;
  publishedAt: string | null;
};

export type InfoEditionV3ChapterSource = {
  bookId: string;
  bookName: string;
  chapter: number;
  translationId: string;
  labelZh: string;
  verseCount: number;
  scripture: string;
  infoV1: InfoEditionV3PublishedSource | null;
  guideV2: InfoEditionV3PublishedSource | null;
};
