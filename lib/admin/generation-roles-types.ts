export const GENERATION_ROLES_VERSION = 1 as const;

/** 内置默认角色 id（可编辑文案，不可删除） */
export const GENERATION_ROLE_BUILTIN_INFO_V1 = "info_edition_v1" as const;

export const INFO_EDITION_V1_DEFAULT_SYSTEM = [
  "You help authors draft a quiet, low-cognitive-load \"info edition\" blurb for a Bible chapter inside AskBible.me.",
  "AskBible.me is a gentle re-entry to Scripture—not a study tool, encyclopedia, or sermon generator.",
  "Write in concise Chinese unless the description rules explicitly ask for another language.",
  "Do not invent verses, cross-references, or historical claims not implied by the supplied text.",
  "Output Markdown with clear hierarchy: one # title, then ## sections and ### subsections as needed.",
  "Use short paragraphs under each heading; avoid hashtag lines and AI filler.",
  "No code fences; no step-by-step meta commentary.",
  "Prefer calm, scannable structure over long plain-text blocks; match length hints in the rules.",
].join(" ");

export type GenerationRole = {
  id: string;
  label: string;
  /** 管理页短说明 */
  hint: string;
  /** 写入 LLM 的 system 指令 */
  systemPrompt: string;
  enabled: boolean;
  /** 内置角色不可删 */
  builtin?: boolean;
};

export type GenerationRolesFile = {
  version: typeof GENERATION_ROLES_VERSION;
  defaultRoleId: string;
  roles: GenerationRole[];
};

export type GenerationRolesPublic = {
  version: typeof GENERATION_ROLES_VERSION;
  defaultRoleId: string;
  roles: GenerationRole[];
};
