import type { GenerationRole } from "@/lib/admin/generation-roles-types";

export const INFO_EDITION_V4_COMPILE_ROLE_ID = "info_edition_v4_compile" as const;
export const INFO_EDITION_V4_REVIEW_ROLE_ID = "info_edition_v4_review" as const;
export const INFO_EDITION_V4_REVISE_ROLE_ID = "info_edition_v4_revise" as const;

export const INFO_EDITION_V4_ROLE_IDS = [
  INFO_EDITION_V4_COMPILE_ROLE_ID,
  INFO_EDITION_V4_REVIEW_ROLE_ID,
  INFO_EDITION_V4_REVISE_ROLE_ID,
] as const;

export type InfoEditionV4RolePhase = "compile" | "review" | "revise";

export function v4PhaseFromRoleId(roleId: string): InfoEditionV4RolePhase | null {
  if (roleId === INFO_EDITION_V4_COMPILE_ROLE_ID) return "compile";
  if (roleId === INFO_EDITION_V4_REVIEW_ROLE_ID) return "review";
  if (roleId === INFO_EDITION_V4_REVISE_ROLE_ID) return "revise";
  return null;
}

export function isInfoEditionV4CompileRole(role: Pick<GenerationRole, "id">): boolean {
  return v4PhaseFromRoleId(role.id) === "compile";
}

export function isInfoEditionV4ReviewRole(role: Pick<GenerationRole, "id">): boolean {
  return v4PhaseFromRoleId(role.id) === "review";
}

export function isInfoEditionV4ReviseRole(role: Pick<GenerationRole, "id">): boolean {
  return v4PhaseFromRoleId(role.id) === "revise";
}

export function sortRolesForV4Phase<T extends GenerationRole>(
  roles: T[],
  phase: InfoEditionV4RolePhase,
): T[] {
  const filtered =
    phase === "compile"
      ? roles.filter(isInfoEditionV4CompileRole)
      : phase === "review"
        ? roles.filter(isInfoEditionV4ReviewRole)
        : roles.filter(isInfoEditionV4ReviseRole);
  const order: Record<string, number> = {
    [INFO_EDITION_V4_COMPILE_ROLE_ID]: 300,
    [INFO_EDITION_V4_REVIEW_ROLE_ID]: 200,
    [INFO_EDITION_V4_REVISE_ROLE_ID]: 100,
  };
  return [...filtered].sort((a, b) => (order[b.id] ?? 0) - (order[a.id] ?? 0));
}

export function pickDefaultV4RoleIds(
  roles: Pick<GenerationRole, "id">[],
  phase: InfoEditionV4RolePhase,
): string[] {
  const id =
    phase === "compile"
      ? INFO_EDITION_V4_COMPILE_ROLE_ID
      : phase === "review"
        ? INFO_EDITION_V4_REVIEW_ROLE_ID
        : INFO_EDITION_V4_REVISE_ROLE_ID;
  return roles.some((r) => r.id === id) ? [id] : [];
}
