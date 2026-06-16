import type { GenerationRole } from "@/lib/admin/generation-roles-types";
import { createChatCompletion } from "@/lib/ai/openai-compatible";
import { resolveAISettings } from "@/lib/ai/resolve-settings";
import type { AISettings, ResolvedAISettings } from "@/lib/ai/types";
import { infoEditionReaderMaxTokens } from "@/lib/bible/info-edition-reader-max-tokens";
import {
  INFO_EDITION_GUIDE_V2_ROLE_ID,
  INFO_EDITION_GUIDE_V2_ROLE_LABEL,
  INFO_EDITION_V1_PUBLISH_ROLE_ID,
  type InfoEditionReaderVariant,
} from "@/lib/bible/info-edition-v1-publish";
import { validateInfoEditionOutput } from "@/lib/bible/info-edition-v1-output-validate";
import { buildInfoEditionV3CorrectionMessages } from "@/lib/bible/info-edition-v3-correction-prompt";
import {
  correctionPhaseFromRoleId,
  INFO_EDITION_V3_CRITIQUE_ROLE_ID,
  INFO_EDITION_V3_REVISE_GUIDE_ROLE_ID,
  INFO_EDITION_V3_REVISE_INFO_ROLE_ID,
  type InfoEditionV3CorrectionPhase,
} from "@/lib/bible/info-edition-v3-correction-roles";
import type { InfoEditionV3ChapterSource } from "@/lib/bible/info-edition-v3-correction-types";
import { publishInfoEditionV3Revision } from "@/lib/bible/info-edition-v3-publish-revision";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";

export type CritiqueProfile = {
  id: string;
  name: string;
  settings: AISettings;
};

const V3_CRITIQUE_MAX_TOKENS = 4_096;
const V3_TIMEOUT_MS = 180_000;

function generationFromResult(
  profile: CritiqueProfile,
  role: GenerationRole,
  result: { text: string } | { error: string },
): InfoEditionV1Generation {
  if ("error" in result) {
    return {
      profileId: profile.id,
      profileName: profile.name,
      generationRoleId: role.id,
      generationRoleLabel: role.label,
      text: "",
      charCount: 0,
      error: result.error,
    };
  }
  const text = result.text;
  return {
    profileId: profile.id,
    profileName: profile.name,
    generationRoleId: role.id,
    generationRoleLabel: role.label,
    text,
    charCount: text.length,
  };
}

async function runV3Phase(
  phase: InfoEditionV3CorrectionPhase,
  opts: {
    source: InfoEditionV3ChapterSource;
    profile: CritiqueProfile;
    role: GenerationRole;
    settings: ResolvedAISettings;
    editorNotes?: string;
    critiqueText?: string;
    variant?: InfoEditionReaderVariant;
  },
): Promise<InfoEditionV1Generation> {
  const messages = buildInfoEditionV3CorrectionMessages({
    phase,
    systemPrompt: opts.role.systemPrompt,
    source: opts.source,
    editorNotes: opts.editorNotes,
    critiqueText: opts.critiqueText,
  });

  const maxTokens =
    phase === "critique"
      ? V3_CRITIQUE_MAX_TOKENS
      : infoEditionReaderMaxTokens(opts.variant ?? (phase === "revise_guide" ? "guide" : "info"));

  const result = await createChatCompletion(opts.settings, messages, {
    maxTokens,
    timeoutMs: V3_TIMEOUT_MS,
  });
  return generationFromResult(opts.profile, opts.role, result);
}

/** 多 AI 并行：同时诊断已发布讲解版 V1 + 发现版 V2，只输出问题清单。 */
export async function runInfoEditionV3CritiqueCompare(opts: {
  source: InfoEditionV3ChapterSource;
  profiles: CritiqueProfile[];
  roles: GenerationRole[];
  editorNotes?: string;
}): Promise<InfoEditionV1Generation[]> {
  const { source, profiles, roles, editorNotes = "" } = opts;
  const critiqueRoles = roles.filter((r) => correctionPhaseFromRoleId(r.id) === "critique");
  const generations: InfoEditionV1Generation[] = [];

  for (const role of critiqueRoles) {
    for (const profile of profiles) {
      const resolved = resolveAISettings(profile.settings, { profileId: profile.id });
      if ("error" in resolved) {
        generations.push({
          profileId: profile.id,
          profileName: profile.name,
          generationRoleId: role.id,
          generationRoleLabel: role.label,
          text: "",
          charCount: 0,
          error: resolved.error,
        });
        continue;
      }

      const gen = await runV3Phase("critique", {
        source,
        profile,
        role,
        settings: resolved,
        editorNotes,
      });
      generations.push(gen);
    }
  }

  return generations;
}

export type V3CorrectionPipelineResult = {
  bookId: string;
  chapter: number;
  critique: InfoEditionV1Generation;
  reviseInfo: InfoEditionV1Generation | null;
  reviseGuide: InfoEditionV1Generation | null;
  publishedInfo: InfoEditionV1PublishedChapter | null;
  publishedGuide: InfoEditionV1PublishedChapter | null;
  errors: string[];
};

/** DeepSeek 单路：找错诊断 → 修订讲解/发现 → 校验并写入发布缓存。 */
export async function runInfoEditionV3CorrectionPipeline(
  cwd: string,
  source: InfoEditionV3ChapterSource,
  roles: GenerationRole[],
  profile: CritiqueProfile,
  settings: ResolvedAISettings,
  opts?: { editorNotes?: string; critiqueText?: string; publish?: boolean },
): Promise<V3CorrectionPipelineResult> {
  const publish = opts?.publish !== false;
  const errors: string[] = [];
  const critiqueRole = roles.find((r) => r.id === INFO_EDITION_V3_CRITIQUE_ROLE_ID);
  const reviseInfoRole = roles.find((r) => r.id === INFO_EDITION_V3_REVISE_INFO_ROLE_ID);
  const reviseGuideRole = roles.find((r) => r.id === INFO_EDITION_V3_REVISE_GUIDE_ROLE_ID);

  if (!critiqueRole) {
    return {
      bookId: source.bookId,
      chapter: source.chapter,
      critique: {
        profileId: profile.id,
        profileName: profile.name,
        generationRoleId: INFO_EDITION_V3_CRITIQUE_ROLE_ID,
        generationRoleLabel: "V3·找错诊断",
        text: "",
        charCount: 0,
        error: "缺少 V3·找错诊断角色。",
      },
      reviseInfo: null,
      reviseGuide: null,
      publishedInfo: null,
      publishedGuide: null,
      errors: ["缺少 V3·找错诊断角色。"],
    };
  }

  let critiqueText = opts?.critiqueText?.trim() ?? "";
  let critique: InfoEditionV1Generation;

  if (critiqueText) {
    critique = {
      profileId: profile.id,
      profileName: profile.name,
      generationRoleId: critiqueRole.id,
      generationRoleLabel: critiqueRole.label,
      text: critiqueText,
      charCount: critiqueText.length,
    };
  } else {
    critique = await runV3Phase("critique", {
      source,
      profile,
      role: critiqueRole,
      settings,
      editorNotes: opts?.editorNotes,
    });
    if (critique.error || !critique.text.trim()) {
      errors.push(critique.error ?? "找错诊断未返回正文。");
      return {
        bookId: source.bookId,
        chapter: source.chapter,
        critique,
        reviseInfo: null,
        reviseGuide: null,
        publishedInfo: null,
        publishedGuide: null,
        errors,
      };
    }
    critiqueText = critique.text.trim();
  }

  let reviseInfo: InfoEditionV1Generation | null = null;
  let reviseGuide: InfoEditionV1Generation | null = null;
  let publishedInfo: InfoEditionV1PublishedChapter | null = null;
  let publishedGuide: InfoEditionV1PublishedChapter | null = null;

  if (source.infoV1?.markdown.trim() && reviseInfoRole) {
    reviseInfo = await runV3Phase("revise_info", {
      source,
      profile,
      role: reviseInfoRole,
      settings,
      critiqueText,
      variant: "info",
    });
    if (reviseInfo.error || !reviseInfo.text.trim()) {
      errors.push(`讲解版修订失败：${reviseInfo.error ?? "无正文"}`);
    } else {
      const check = validateInfoEditionOutput(reviseInfo.text, "info");
      if (!check.ok) {
        errors.push(`讲解版修订校验未通过：${check.checks.map((c) => c.message).join("; ")}`);
      } else if (publish) {
        publishedInfo = publishInfoEditionV3Revision(cwd, source.bookId, source.chapter, {
          variant: "info",
          markdown: reviseInfo.text,
          profileId: profile.id,
          profileName: profile.name,
          roleId: INFO_EDITION_V1_PUBLISH_ROLE_ID,
          roleLabel: source.infoV1.roleLabel || "基础版",
        });
      }
    }
  }

  if (source.guideV2?.markdown.trim() && reviseGuideRole) {
    reviseGuide = await runV3Phase("revise_guide", {
      source,
      profile,
      role: reviseGuideRole,
      settings,
      critiqueText,
      variant: "guide",
    });
    if (reviseGuide.error || !reviseGuide.text.trim()) {
      errors.push(`发现版修订失败：${reviseGuide.error ?? "无正文"}`);
    } else {
      const check = validateInfoEditionOutput(reviseGuide.text, "guide");
      if (!check.ok) {
        errors.push(`发现版修订校验未通过：${check.checks.map((c) => c.message).join("; ")}`);
      } else if (publish) {
        publishedGuide = publishInfoEditionV3Revision(cwd, source.bookId, source.chapter, {
          variant: "guide",
          markdown: reviseGuide.text,
          profileId: profile.id,
          profileName: profile.name,
          roleId: INFO_EDITION_GUIDE_V2_ROLE_ID,
          roleLabel: source.guideV2.roleLabel || INFO_EDITION_GUIDE_V2_ROLE_LABEL,
        });
      }
    }
  }

  return {
    bookId: source.bookId,
    chapter: source.chapter,
    critique,
    reviseInfo,
    reviseGuide,
    publishedInfo,
    publishedGuide,
    errors,
  };
}
