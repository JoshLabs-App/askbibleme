import fs from "node:fs";
import path from "node:path";
import {
  INFO_EDITION_V1_PUBLISH_PROFILE_ID,
  INFO_EDITION_V1_PUBLISH_ROLE_ID,
} from "@/lib/bible/info-edition-v1-publish";
import {
  INFO_EDITION_V1_HISTORY_MAX,
  INFO_EDITION_V1_STORE_VERSION,
  type InfoEditionV1Draft,
  type InfoEditionV1Generation,
  type InfoEditionV1HistoryEntry,
  type InfoEditionV1Workspace,
} from "@/lib/bible/info-edition-v1-types";

const REL = path.join("data", "bible", "info-edition-v1-workspace.json");

function absPath(cwd: string): string {
  return path.join(cwd, REL);
}

export function defaultInfoEditionV1Draft(): InfoEditionV1Draft {
  return {
    bookId: "GEN",
    chapter: 1,
    descriptionRules: "",
    selectedProfileIds: [INFO_EDITION_V1_PUBLISH_PROFILE_ID],
    selectedGenerationRoleIds: [INFO_EDITION_V1_PUBLISH_ROLE_ID],
  };
}

function defaultWorkspace(): InfoEditionV1Workspace {
  return {
    version: INFO_EDITION_V1_STORE_VERSION,
    current: defaultInfoEditionV1Draft(),
    history: [],
  };
}

function normalizeDraft(raw: unknown): InfoEditionV1Draft {
  const d = defaultInfoEditionV1Draft();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const bookId = typeof o.bookId === "string" ? o.bookId.trim().toUpperCase() : d.bookId;
  const chapter = Number(o.chapter);
  const descriptionRules = typeof o.descriptionRules === "string" ? o.descriptionRules : d.descriptionRules;
  const selectedProfileIds = Array.isArray(o.selectedProfileIds)
    ? o.selectedProfileIds
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
    : d.selectedProfileIds;
  const legacyRoleId =
    typeof o.generationRoleId === "string" ? o.generationRoleId.trim() : "";
  const selectedGenerationRoleIds = Array.isArray(o.selectedGenerationRoleIds)
    ? o.selectedGenerationRoleIds
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
    : legacyRoleId
      ? [legacyRoleId]
      : d.selectedGenerationRoleIds;
  return {
    bookId: bookId || d.bookId,
    chapter: Number.isInteger(chapter) && chapter >= 1 ? chapter : d.chapter,
    descriptionRules,
    selectedProfileIds: [...new Set(selectedProfileIds)],
    selectedGenerationRoleIds: [...new Set(selectedGenerationRoleIds)],
  };
}

function normalizeHistoryEntry(raw: unknown): InfoEditionV1HistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const savedAt = typeof o.savedAt === "string" ? o.savedAt : "";
  if (!id || !savedAt) return null;
  const draft = normalizeDraft(raw);
  const descriptionCharCount =
    typeof o.descriptionCharCount === "number" && o.descriptionCharCount >= 0
      ? o.descriptionCharCount
      : draft.descriptionRules.length;
  const entry: InfoEditionV1HistoryEntry = {
    ...draft,
    id,
    savedAt,
    descriptionCharCount,
  };
  const kind = o.entryKind;
  if (kind === "compare" || kind === "draft") {
    entry.entryKind = kind;
  }
  if (typeof o.generatedAt === "string" && o.generatedAt.trim()) {
    entry.generatedAt = o.generatedAt.trim();
  }
  if (Array.isArray(o.generations)) {
    const gens: InfoEditionV1Generation[] = [];
    for (const g of o.generations) {
      if (!g || typeof g !== "object") continue;
      const row = g as Record<string, unknown>;
      const profileId = typeof row.profileId === "string" ? row.profileId : "";
      const profileName = typeof row.profileName === "string" ? row.profileName : "";
      const generationRoleId = typeof row.generationRoleId === "string" ? row.generationRoleId : "";
      const generationRoleLabel =
        typeof row.generationRoleLabel === "string" ? row.generationRoleLabel : "";
      const text = typeof row.text === "string" ? row.text : "";
      const charCount = typeof row.charCount === "number" ? row.charCount : text.length;
      const error = typeof row.error === "string" ? row.error : undefined;
      if (!profileId) continue;
      gens.push({
        profileId,
        profileName,
        generationRoleId: generationRoleId || "unknown",
        generationRoleLabel: generationRoleLabel || generationRoleId || "—",
        text,
        charCount,
        error,
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

function normalizeWorkspace(raw: unknown): InfoEditionV1Workspace {
  if (!raw || typeof raw !== "object") return defaultWorkspace();
  const o = raw as Record<string, unknown>;
  const current = normalizeDraft(o.current);
  const history = Array.isArray(o.history)
    ? o.history.map(normalizeHistoryEntry).filter((x): x is InfoEditionV1HistoryEntry => x !== null)
    : [];
  return {
    version: INFO_EDITION_V1_STORE_VERSION,
    current,
    history: history.slice(0, INFO_EDITION_V1_HISTORY_MAX),
  };
}

export function readInfoEditionV1WorkspaceSync(cwd: string): InfoEditionV1Workspace {
  const file = absPath(cwd);
  if (!fs.existsSync(file)) return defaultWorkspace();
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return normalizeWorkspace(raw);
  } catch {
    return defaultWorkspace();
  }
}

export function writeInfoEditionV1WorkspaceSync(cwd: string, workspace: InfoEditionV1Workspace): void {
  const file = absPath(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const next: InfoEditionV1Workspace = {
    version: INFO_EDITION_V1_STORE_VERSION,
    current: normalizeDraft(workspace.current),
    history: workspace.history.slice(0, INFO_EDITION_V1_HISTORY_MAX),
  };
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export function newHistoryEntryId(): string {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const INFO_EDITION_V1_WORKSPACE_REL = REL;
