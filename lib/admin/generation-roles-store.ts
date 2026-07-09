import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  GENERATION_ROLE_BUILTIN_INFO_V1,
  GENERATION_ROLES_VERSION,
  INFO_EDITION_V1_DEFAULT_SYSTEM,
  type GenerationRole,
  type GenerationRolesFile,
  type GenerationRolesPublic,
} from "@/lib/admin/generation-roles-types";
import { infoEditionV4BuiltinRoles } from "@/lib/bible/info-edition-v4-generation-roles";

const REL = path.join("data", "admin", "generation-roles.json");
const MAX_ROLES = 24;
const MAX_LABEL = 48;
const MAX_HINT = 160;
const MAX_SYSTEM = 12_000;

function absPath(cwd: string): string {
  return path.join(cwd, REL);
}

function builtinRoles(): GenerationRole[] {
  return [
    {
      id: GENERATION_ROLE_BUILTIN_INFO_V1,
      label: "V1 信息版（默认）",
      hint: "安静、克制的章节信息版；用于 V1 信息版多模型对比。",
      systemPrompt: INFO_EDITION_V1_DEFAULT_SYSTEM,
      enabled: true,
      builtin: true,
    },
    ...infoEditionV4BuiltinRoles(),
  ];
}

function defaultFile(): GenerationRolesFile {
  const roles = builtinRoles();
  return {
    version: GENERATION_ROLES_VERSION,
    defaultRoleId: GENERATION_ROLE_BUILTIN_INFO_V1,
    roles,
  };
}

function normalizeRole(raw: unknown, fallback?: GenerationRole): GenerationRole | null {
  if (!raw || typeof raw !== "object") return fallback ?? null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : fallback?.id ?? "";
  if (!id) return null;
  const label =
    typeof o.label === "string" ? o.label.trim().slice(0, MAX_LABEL) : fallback?.label ?? id;
  const hint =
    typeof o.hint === "string" ? o.hint.trim().slice(0, MAX_HINT) : fallback?.hint ?? "";
  const systemPrompt =
    typeof o.systemPrompt === "string"
      ? o.systemPrompt.trim().slice(0, MAX_SYSTEM)
      : fallback?.systemPrompt ?? "";
  const enabled = typeof o.enabled === "boolean" ? o.enabled : (fallback?.enabled ?? true);
  const builtin = Boolean(fallback?.builtin) || o.builtin === true;
  if (!systemPrompt) return null;
  return { id, label: label || id, hint, systemPrompt, enabled, ...(builtin ? { builtin: true } : {}) };
}

function mergeWithBuiltins(roles: GenerationRole[]): GenerationRole[] {
  const builtins = builtinRoles();
  const byId = new Map<string, GenerationRole>();
  for (const b of builtins) byId.set(b.id, { ...b });
  for (const r of roles) {
    const base = byId.get(r.id);
    const merged = normalizeRole(r, base ?? undefined);
    if (merged) byId.set(merged.id, merged);
  }
  return [...byId.values()];
}

function normalizeFile(raw: unknown): GenerationRolesFile {
  const base = defaultFile();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const rolesIn: GenerationRole[] = [];
  if (Array.isArray(o.roles)) {
    for (const row of o.roles) {
      const r = normalizeRole(row);
      if (r) rolesIn.push(r);
    }
  }
  const roles = mergeWithBuiltins(rolesIn).slice(0, MAX_ROLES);
  let defaultRoleId =
    typeof o.defaultRoleId === "string" ? o.defaultRoleId.trim() : base.defaultRoleId;
  if (!roles.some((r) => r.id === defaultRoleId && r.enabled)) {
    defaultRoleId =
      roles.find((r) => r.enabled)?.id ?? GENERATION_ROLE_BUILTIN_INFO_V1;
  }
  return {
    version: GENERATION_ROLES_VERSION,
    defaultRoleId,
    roles,
  };
}

export function newGenerationRoleId(): string {
  return `role_${randomUUID().slice(0, 8)}`;
}

export function readGenerationRolesSync(cwd: string): GenerationRolesFile {
  const p = absPath(cwd);
  if (!fs.existsSync(p)) return defaultFile();
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
    return normalizeFile(raw);
  } catch {
    return defaultFile();
  }
}

export function writeGenerationRolesSync(cwd: string, file: GenerationRolesFile): void {
  const normalized = normalizeFile(file);
  const dir = path.dirname(absPath(cwd));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(absPath(cwd), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

export function toPublicRoles(file: GenerationRolesFile): GenerationRolesPublic {
  return {
    version: file.version,
    defaultRoleId: file.defaultRoleId,
    roles: file.roles.map((r) => ({ ...r })),
  };
}

export function resolveGenerationRole(
  file: GenerationRolesFile,
  roleId?: string | null,
): GenerationRole | null {
  const id = roleId?.trim() || file.defaultRoleId;
  const role = file.roles.find((r) => r.id === id && r.enabled);
  if (role) return role;
  return file.roles.find((r) => r.id === file.defaultRoleId && r.enabled) ?? null;
}
