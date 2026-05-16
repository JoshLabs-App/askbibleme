import type { AISettings } from "@/lib/ai/types";

export const INFO_EDITION_V1_STORE_VERSION = 1 as const;
export const INFO_EDITION_V1_HISTORY_MAX = 48;
/** 一次生成最多「角色 × AI」组合数 */
export const INFO_EDITION_V1_MAX_COMPARE_RUNS = 12;

export type InfoEditionV1Generation = {
  profileId: string;
  profileName: string;
  generationRoleId: string;
  generationRoleLabel: string;
  text: string;
  charCount: number;
  error?: string;
};

export type InfoEditionV1Draft = {
  bookId: string;
  chapter: number;
  descriptionRules: string;
  selectedProfileIds: string[];
  /** 生成角色 id 列表，见 data/admin/generation-roles.json */
  selectedGenerationRoleIds: string[];
  /** @deprecated 旧草稿单角色，读取时并入 selectedGenerationRoleIds */
  generationRoleId?: string;
};

/** compare：生成对比后自动保存；draft：手动「档」仅存设置 */
export type InfoEditionV1EntryKind = "compare" | "draft";

export type InfoEditionV1HistoryEntry = InfoEditionV1Draft & {
  id: string;
  savedAt: string;
  descriptionCharCount: number;
  entryKind?: InfoEditionV1EntryKind;
  generations?: InfoEditionV1Generation[];
  generatedAt?: string;
};

export type InfoEditionV1Workspace = {
  version: typeof INFO_EDITION_V1_STORE_VERSION;
  current: InfoEditionV1Draft;
  history: InfoEditionV1HistoryEntry[];
};

/** Client → generate API */
export type InfoEditionV1GenerateProfile = {
  id: string;
  name: string;
  settings: AISettings;
};
