import fs from "node:fs";
import path from "node:path";
import { INFO_EDITION_V1_PUBLISH_PROFILE_ID } from "@/lib/bible/info-edition-v1-publish";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import {
  INFO_EDITION_V4_COMPILE_ROLE_ID,
  INFO_EDITION_V4_REVISE_ROLE_ID,
} from "@/lib/bible/info-edition-v4-roles";
import {
  INFO_EDITION_V4_HISTORY_MAX,
  INFO_EDITION_V4_STORE_VERSION,
  type InfoEditionV4Draft,
  type InfoEditionV4HistoryEntry,
  type InfoEditionV4PipelinePair,
  type InfoEditionV4Workspace,
} from "@/lib/bible/info-edition-v4-types";

const REL = path.join("data", "bible", "info-edition-v4-workspace.json");

function absPath(cwd: string): string {
  return path.join(cwd, REL);
}

export function defaultInfoEditionV4Draft(): InfoEditionV4Draft {
  return {
    themeTitle: "受洗",
    editorNotes: "",
    compileText: "",
    reviseText: "",
    lastUsedProfileId: INFO_EDITION_V1_PUBLISH_PROFILE_ID,
    selectedProfileIds: [INFO_EDITION_V1_PUBLISH_PROFILE_ID],
    selectedCompileRoleIds: [INFO_EDITION_V4_COMPILE_ROLE_ID],
    selectedReviseRoleIds: [INFO_EDITION_V4_REVISE_ROLE_ID],
  };
}

function defaultWorkspace(): InfoEditionV4Workspace {
  return {
    version: INFO_EDITION_V4_STORE_VERSION,
    current: defaultInfoEditionV4Draft(),
    history: [],
  };
}

function normalizeStringArray(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback;
  const ids = raw.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
  return ids.length ? [...new Set(ids)] : fallback;
}

function normalizeGeneration(raw: unknown): InfoEditionV1Generation | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const profileId = typeof row.profileId === "string" ? row.profileId : "";
  if (!profileId) return null;
  const text = typeof row.text === "string" ? row.text : "";
  return {
    profileId,
    profileName: typeof row.profileName === "string" ? row.profileName : "",
    generationRoleId: typeof row.generationRoleId === "string" ? row.generationRoleId : "unknown",
    generationRoleLabel: typeof row.generationRoleLabel === "string" ? row.generationRoleLabel : "",
    text,
    charCount: typeof row.charCount === "number" ? row.charCount : text.length,
    error: typeof row.error === "string" ? row.error : undefined,
  };
}

function normalizeDraft(raw: unknown): InfoEditionV4Draft {
  const d = defaultInfoEditionV4Draft();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const legacySpec = typeof o.themeSpec === "string" ? o.themeSpec.trim() : "";
  let editorNotes = typeof o.editorNotes === "string" ? o.editorNotes : d.editorNotes;
  if (legacySpec && !editorNotes.trim()) editorNotes = legacySpec;
  const legacyReview = typeof o.reviewText === "string" ? o.reviewText : "";
  let reviseText = typeof o.reviseText === "string" ? o.reviseText : d.reviseText;
  if (legacyReview && !reviseText.trim()) reviseText = legacyReview;
  const lastUsedProfileId =
    typeof o.lastUsedProfileId === "string" && o.lastUsedProfileId.trim()
      ? o.lastUsedProfileId.trim()
      : d.lastUsedProfileId;
  let selectedProfileIds = normalizeStringArray(o.selectedProfileIds, d.selectedProfileIds);
  if (!selectedProfileIds.length && lastUsedProfileId) {
    selectedProfileIds = [lastUsedProfileId];
  }
  return {
    themeTitle: typeof o.themeTitle === "string" ? o.themeTitle : d.themeTitle,
    editorNotes,
    compileText: typeof o.compileText === "string" ? o.compileText : d.compileText,
    reviseText,
    lastUsedProfileId,
    selectedProfileIds,
    selectedCompileRoleIds: normalizeStringArray(o.selectedCompileRoleIds, d.selectedCompileRoleIds),
    selectedReviseRoleIds: normalizeStringArray(o.selectedReviseRoleIds, d.selectedReviseRoleIds),
  };
}

function normalizePipelinePairs(raw: unknown): InfoEditionV4PipelinePair[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: InfoEditionV4PipelinePair[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const compile = normalizeGeneration(row.compile);
    if (!compile) continue;
    const revise = row.revise != null ? normalizeGeneration(row.revise) : null;
    out.push({ compile, revise });
  }
  return out.length ? out : undefined;
}

function normalizeHistoryEntry(raw: unknown): InfoEditionV4HistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const savedAt = typeof o.savedAt === "string" ? o.savedAt : "";
  if (!id || !savedAt) return null;
  const draft = normalizeDraft(raw);
  const entry: InfoEditionV4HistoryEntry = {
    ...draft,
    id,
    savedAt,
    themeTitleCharCount:
      typeof o.themeTitleCharCount === "number" && o.themeTitleCharCount >= 0
        ? o.themeTitleCharCount
        : draft.themeTitle.length,
  };
  const kind = o.entryKind;
  if (kind === "compile" || kind === "revise" || kind === "pipeline" || kind === "draft") {
    entry.entryKind = kind;
  }
  const phase = o.phase;
  if (phase === "compile" || phase === "revise" || phase === "pipeline") entry.phase = phase;
  if (typeof o.generatedAt === "string" && o.generatedAt.trim()) {
    entry.generatedAt = o.generatedAt.trim();
  }
  const pipelinePairs = normalizePipelinePairs(o.pipelinePairs);
  if (pipelinePairs?.length) {
    entry.pipelinePairs = pipelinePairs;
    if (!entry.entryKind) entry.entryKind = "pipeline";
    if (!entry.phase) entry.phase = "pipeline";
  }
  if (Array.isArray(o.generations)) {
    const gens: InfoEditionV1Generation[] = [];
    for (const g of o.generations) {
      const gen = normalizeGeneration(g);
      if (gen) gens.push(gen);
    }
    if (gens.length) {
      entry.generations = gens;
      if (!entry.entryKind) entry.entryKind = entry.phase ?? "compile";
    }
  }
  if (!entry.entryKind) entry.entryKind = "draft";
  return entry;
}

function normalizeWorkspace(raw: unknown): InfoEditionV4Workspace {
  if (!raw || typeof raw !== "object") return defaultWorkspace();
  const o = raw as Record<string, unknown>;
  const history = Array.isArray(o.history)
    ? o.history.map(normalizeHistoryEntry).filter((x): x is InfoEditionV4HistoryEntry => x !== null)
    : [];
  return {
    version: INFO_EDITION_V4_STORE_VERSION,
    current: normalizeDraft(o.current),
    history: history.slice(0, INFO_EDITION_V4_HISTORY_MAX),
  };
}

export function readInfoEditionV4WorkspaceSync(cwd: string): InfoEditionV4Workspace {
  const file = absPath(cwd);
  if (!fs.existsSync(file)) return defaultWorkspace();
  try {
    return normalizeWorkspace(JSON.parse(fs.readFileSync(file, "utf8")) as unknown);
  } catch {
    return defaultWorkspace();
  }
}

export function writeInfoEditionV4WorkspaceSync(cwd: string, workspace: InfoEditionV4Workspace): void {
  const file = absPath(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const next: InfoEditionV4Workspace = {
    version: INFO_EDITION_V4_STORE_VERSION,
    current: normalizeDraft(workspace.current),
    history: workspace.history.slice(0, INFO_EDITION_V4_HISTORY_MAX),
  };
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export function newV4HistoryEntryId(): string {
  return `v4_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const INFO_EDITION_V4_WORKSPACE_REL = REL;
