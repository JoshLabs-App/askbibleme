import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";

export const INFO_EDITION_V4_STORE_VERSION = 1 as const;
export const INFO_EDITION_V4_HISTORY_MAX = 48;
export const INFO_EDITION_V4_MAX_COMPARE_RUNS = 12;

export type InfoEditionV4Phase = "compile" | "revise" | "pipeline";

export type InfoEditionV4Draft = {
  themeTitle: string;
  /** 可选补充；格式与规则以「生成角色」system prompt 为准 */
  editorNotes: string;
  /** 汇编初稿（末次运行缓存） */
  compileText: string;
  /** 优化成稿（末次运行缓存） */
  reviseText: string;
  /** 上次成功运行时的 AI profile，用于默认选中 */
  lastUsedProfileId: string;
  selectedProfileIds: string[];
  selectedCompileRoleIds: string[];
  selectedReviseRoleIds: string[];
};

export type InfoEditionV4EntryKind = "compile" | "revise" | "pipeline" | "draft";

export type InfoEditionV4PipelinePair = {
  compile: InfoEditionV1Generation;
  revise: InfoEditionV1Generation | null;
};

export type InfoEditionV4HistoryEntry = InfoEditionV4Draft & {
  id: string;
  savedAt: string;
  themeTitleCharCount: number;
  entryKind?: InfoEditionV4EntryKind;
  phase?: InfoEditionV4Phase;
  generations?: InfoEditionV1Generation[];
  pipelinePairs?: InfoEditionV4PipelinePair[];
  generatedAt?: string;
};

export type InfoEditionV4Workspace = {
  version: typeof INFO_EDITION_V4_STORE_VERSION;
  current: InfoEditionV4Draft;
  history: InfoEditionV4HistoryEntry[];
};
