import type { GenerationRole } from "@/lib/admin/generation-roles-types";
import { createChatCompletion } from "@/lib/ai/openai-compatible";
import { resolveAISettings } from "@/lib/ai/resolve-settings";
import type { AISettings, ResolvedAISettings } from "@/lib/ai/types";
import { buildInfoEditionV4Messages } from "@/lib/bible/info-edition-v4-prompt";
import {
  isInfoEditionV4CompileRole,
  isInfoEditionV4ReviewRole,
  isInfoEditionV4ReviseRole,
  type InfoEditionV4RolePhase,
} from "@/lib/bible/info-edition-v4-roles";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";

export type V4Profile = {
  id: string;
  name: string;
  settings: AISettings;
};

const V4_COMPILE_MAX_TOKENS = 8_192;
const V4_REVIEW_MAX_TOKENS = 4_096;
const V4_REVISE_MAX_TOKENS = 8_192;
const V4_TIMEOUT_MS = 180_000;

function maxTokensForPhase(phase: InfoEditionV4RolePhase): number {
  if (phase === "review") return V4_REVIEW_MAX_TOKENS;
  if (phase === "revise") return V4_REVISE_MAX_TOKENS;
  return V4_COMPILE_MAX_TOKENS;
}

function generationFromResult(
  profile: V4Profile,
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

async function runV4Phase(
  phase: InfoEditionV4RolePhase,
  opts: {
    profile: V4Profile;
    role: GenerationRole;
    settings: ResolvedAISettings;
    themeTitle: string;
    editorNotes?: string;
    compileText?: string;
    reviewText?: string;
  },
): Promise<InfoEditionV1Generation> {
  const messages = buildInfoEditionV4Messages({
    phase,
    systemPrompt: opts.role.systemPrompt,
    themeTitle: opts.themeTitle,
    editorNotes: opts.editorNotes,
    compileText: opts.compileText,
    reviewText: opts.reviewText,
  });
  const result = await createChatCompletion(opts.settings, messages, {
    maxTokens: maxTokensForPhase(phase),
    timeoutMs: V4_TIMEOUT_MS,
  });
  return generationFromResult(opts.profile, opts.role, result);
}

function roleMatchesPhase(role: GenerationRole, phase: InfoEditionV4RolePhase): boolean {
  if (phase === "compile") return isInfoEditionV4CompileRole(role);
  if (phase === "review") return isInfoEditionV4ReviewRole(role);
  return isInfoEditionV4ReviseRole(role);
}

export async function runInfoEditionV4Compare(opts: {
  phase: InfoEditionV4RolePhase;
  themeTitle: string;
  editorNotes?: string;
  compileText?: string;
  reviewText?: string;
  profiles: V4Profile[];
  roles: GenerationRole[];
}): Promise<InfoEditionV1Generation[]> {
  const {
    phase,
    themeTitle,
    editorNotes = "",
    compileText = "",
    reviewText = "",
    profiles,
    roles,
  } = opts;
  const phaseRoles = roles.filter((r) => roleMatchesPhase(r, phase));
  const generations: InfoEditionV1Generation[] = [];

  for (const role of phaseRoles) {
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
      const gen = await runV4Phase(phase, {
        profile,
        role,
        settings: resolved,
        themeTitle,
        editorNotes,
        compileText,
        reviewText,
      });
      generations.push(gen);
    }
  }

  return generations;
}
