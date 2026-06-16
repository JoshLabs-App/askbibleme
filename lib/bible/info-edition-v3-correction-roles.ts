import type { GenerationRole } from "@/lib/admin/generation-roles-types";

export const INFO_EDITION_V3_CRITIQUE_ROLE_ID = "info_edition_v3_critique" as const;
export const INFO_EDITION_V3_REVISE_INFO_ROLE_ID = "info_edition_v3_revise_info" as const;
export const INFO_EDITION_V3_REVISE_GUIDE_ROLE_ID = "info_edition_v3_revise_guide" as const;

export const INFO_EDITION_V3_CORRECTION_ROLE_IDS = [
  INFO_EDITION_V3_CRITIQUE_ROLE_ID,
  INFO_EDITION_V3_REVISE_INFO_ROLE_ID,
  INFO_EDITION_V3_REVISE_GUIDE_ROLE_ID,
] as const;

export type InfoEditionV3CorrectionPhase = "critique" | "revise_info" | "revise_guide";

export function correctionPhaseFromRoleId(roleId: string): InfoEditionV3CorrectionPhase | null {
  if (roleId === INFO_EDITION_V3_CRITIQUE_ROLE_ID) return "critique";
  if (roleId === INFO_EDITION_V3_REVISE_INFO_ROLE_ID) return "revise_info";
  if (roleId === INFO_EDITION_V3_REVISE_GUIDE_ROLE_ID) return "revise_guide";
  return null;
}

export function isInfoEditionV3CorrectionRole(role: Pick<GenerationRole, "id">): boolean {
  return correctionPhaseFromRoleId(role.id) !== null;
}

export function isInfoEditionV3CritiqueRole(role: Pick<GenerationRole, "id">): boolean {
  return correctionPhaseFromRoleId(role.id) === "critique";
}

export function sortRolesForV3Correction<T extends GenerationRole>(roles: T[]): T[] {
  const order: Record<string, number> = {
    [INFO_EDITION_V3_CRITIQUE_ROLE_ID]: 300,
    [INFO_EDITION_V3_REVISE_INFO_ROLE_ID]: 200,
    [INFO_EDITION_V3_REVISE_GUIDE_ROLE_ID]: 100,
  };
  return [...roles].sort((a, b) => (order[b.id] ?? 0) - (order[a.id] ?? 0));
}

export function sortRolesForV3Critique<T extends GenerationRole>(roles: T[]): T[] {
  return sortRolesForV3Correction(roles.filter(isInfoEditionV3CritiqueRole));
}

export function pickDefaultV3CritiqueRoleIds(roles: Pick<GenerationRole, "id">[]): string[] {
  const critique = roles.find((r) => r.id === INFO_EDITION_V3_CRITIQUE_ROLE_ID);
  return critique ? [critique.id] : [];
}

export function pickDefaultV3CorrectionRoleIds(roles: Pick<GenerationRole, "id">[]): string[] {
  return pickDefaultV3CritiqueRoleIds(roles);
}
