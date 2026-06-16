import fs from "node:fs";
import path from "node:path";
import { INFO_EDITION_V1_PUBLISH_PROFILE_ID } from "@/lib/bible/info-edition-v1-publish";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import { INFO_EDITION_V3_CRITIQUE_ROLE_ID } from "@/lib/bible/info-edition-v3-correction-roles";
import {
  INFO_EDITION_V3_STORE_VERSION,
  INFO_EDITION_V3_HISTORY_MAX,
  type InfoEditionV3Draft,
  type InfoEditionV3HistoryEntry,
  type InfoEditionV3Workspace,
} from "@/lib/bible/info-edition-v3-correction-types";

const REL = path.join("data", "bible", "info-edition-v3-workspace.json");

function absPath(cwd: string): string {
  return path.join(cwd, REL);
}

export function defaultInfoEditionV3Draft(): InfoEditionV3Draft {
  return {
    bookId: "GEN",
    chapter: 36,
    editorNotes: "",
    critiqueText: "",
    selectedProfileIds: [INFO_EDITION_V1_PUBLISH_PROFILE_ID],
    selectedGenerationRoleIds: [INFO_EDITION_V3_CRITIQUE_ROLE_ID],
  };
}

function defaultWorkspace(): InfoEditionV3Workspace {
  return {
    version: INFO_EDITION_V3_STORE_VERSION,
    current: defaultInfoEditionV3Draft(),
    history: [],
  };
}

function normalizeDraft(raw: unknown): InfoEditionV3Draft {
  const d = defaultInfoEditionV3Draft();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const bookId = typeof o.bookId === "string" ? o.bookId.trim().toUpperCase() : d.bookId;
  const chapter = Number(o.chapter);
  const editorNotes = typeof o.editorNotes === "string" ? o.editorNotes : d.editorNotes;
  const critiqueText = typeof o.critiqueText === "string" ? o.critiqueText : d.critiqueText;
  const selectedProfileIds = Array.isArray(o.selectedProfileIds)
    ? o.selectedProfileIds
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
    : d.selectedProfileIds;
  const selectedGenerationRoleIds = Array.isArray(o.selectedGenerationRoleIds)
    ? o.selectedGenerationRoleIds
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
    : d.selectedGenerationRoleIds;
  return {
    bookId: bookId || d.bookId,
    chapter: Number.isInteger(chapter) && chapter >= 1 ? chapter : d.chapter,
    editorNotes,
    critiqueText,
    selectedProfileIds: [...new Set(selectedProfileIds)],
    selectedGenerationRoleIds: [...new Set(selectedGenerationRoleIds)],
  };
}

function normalizeHistoryEntry(raw: unknown): InfoEditionV3HistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const savedAt = typeof o.savedAt === "string" ? o.savedAt : "";
  if (!id || !savedAt) return null;
  const draft = normalizeDraft(raw);
  const entry: InfoEditionV3HistoryEntry = {
    ...draft,
    id,
    savedAt,
    editorNotesCharCount:
      typeof o.editorNotesCharCount === "number" && o.editorNotesCharCount >= 0
        ? o.editorNotesCharCount
        : draft.editorNotes.length,
    critiqueCharCount:
      typeof o.critiqueCharCount === "number" && o.critiqueCharCount >= 0
        ? o.critiqueCharCount
        : draft.critiqueText.length,
  };
  const kind = o.entryKind;
  if (kind === "compare" || kind === "draft") entry.entryKind = kind;
  if (typeof o.generatedAt === "string" && o.generatedAt.trim()) {
    entry.generatedAt = o.generatedAt.trim();
  }
  if (Array.isArray(o.generations)) {
    const gens: InfoEditionV1Generation[] = [];
    for (const g of o.generations) {
      if (!g || typeof g !== "object") continue;
      const row = g as Record<string, unknown>;
      const profileId = typeof row.profileId === "string" ? row.profileId : "";
      if (!profileId) continue;
      const text = typeof row.text === "string" ? row.text : "";
      gens.push({
        profileId,
        profileName: typeof row.profileName === "string" ? row.profileName : "",
        generationRoleId: typeof row.generationRoleId === "string" ? row.generationRoleId : "unknown",
        generationRoleLabel:
          typeof row.generationRoleLabel === "string" ? row.generationRoleLabel : "",
        text,
        charCount: typeof row.charCount === "number" ? row.charCount : text.length,
        error: typeof row.error === "string" ? row.error : undefined,
      });
    }
    if (gens.length) {
      entry.generations = gens;
      if (!entry.entryKind) entry.entryKind = "compare";
    }
  }
  if (!entry.entryKind) entry.entryKind = "draft";
  return entry;
}

function normalizeWorkspace(raw: unknown): InfoEditionV3Workspace {
  if (!raw || typeof raw !== "object") return defaultWorkspace();
  const o = raw as Record<string, unknown>;
  const history = Array.isArray(o.history)
    ? o.history.map(normalizeHistoryEntry).filter((x): x is InfoEditionV3HistoryEntry => x !== null)
    : [];
  return {
    version: INFO_EDITION_V3_STORE_VERSION,
    current: normalizeDraft(o.current),
    history: history.slice(0, INFO_EDITION_V3_HISTORY_MAX),
  };
}

export function readInfoEditionV3WorkspaceSync(cwd: string): InfoEditionV3Workspace {
  const file = absPath(cwd);
  if (!fs.existsSync(file)) return defaultWorkspace();
  try {
    return normalizeWorkspace(JSON.parse(fs.readFileSync(file, "utf8")) as unknown);
  } catch {
    return defaultWorkspace();
  }
}

export function writeInfoEditionV3WorkspaceSync(cwd: string, workspace: InfoEditionV3Workspace): void {
  const file = absPath(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const next: InfoEditionV3Workspace = {
    version: INFO_EDITION_V3_STORE_VERSION,
    current: normalizeDraft(workspace.current),
    history: workspace.history.slice(0, INFO_EDITION_V3_HISTORY_MAX),
  };
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export function newV3HistoryEntryId(): string {
  return `v3_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const INFO_EDITION_V3_WORKSPACE_REL = REL;
