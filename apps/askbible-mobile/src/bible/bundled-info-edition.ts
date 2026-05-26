import type { InfoEditionReaderVariant, InfoEditionV1PublishedChapter } from "./info-edition-types";

const INFO_EDITION_V1_PUBLISH_ROLE_ID = "info_edition_v1";
const INFO_EDITION_V1_EN_ROLE_ID = "info_edition_v1_en";
const INFO_EDITION_GUIDE_V2_ROLE_ID = "role_356f0ffb";
const INFO_EDITION_GUIDE_V2_EN_ROLE_ID = "role_guide_v2_en";
const GUIDE_V2_ROLE_LABEL_ALIASES = [
  "发现版V2",
  "引导版V2",
  "引导版",
  "Study Guide V2 EN",
  "Guide V2 EN",
] as const;

type PublishedFile = {
  chapters: Record<string, InfoEditionV1PublishedChapter>;
};

type GenerationRolesFile = {
  roles: { id: string; label: string }[];
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const publishedFile = require("../../assets/content/info-edition-v1-published.json") as PublishedFile;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rolesFile = require("../../assets/content/generation-roles.json") as GenerationRolesFile;

function infoEditionChapterKey(bookId: string, chapter: number): string {
  return `${bookId.trim().toUpperCase()}:${chapter}`;
}

function infoEditionReaderChapterKey(bookId: string, chapter: number, roleId: string): string {
  return `${infoEditionChapterKey(bookId, chapter)}:${roleId}`;
}

function resolveReaderGuideRoleId(roles: { id: string; label: string }[]): string {
  const byLabel = roles.find((r) =>
    (GUIDE_V2_ROLE_LABEL_ALIASES as readonly string[]).includes(r.label.trim()),
  );
  if (byLabel) return byLabel.id;
  const byId = roles.find((r) => r.id === INFO_EDITION_GUIDE_V2_ROLE_ID);
  return byId?.id ?? INFO_EDITION_GUIDE_V2_ROLE_ID;
}

function readerVariantToRoleId(
  variant: InfoEditionReaderVariant,
  roles: { id: string; label: string }[],
): string {
  if (variant === "guide") return resolveReaderGuideRoleId(roles);
  return INFO_EDITION_V1_PUBLISH_ROLE_ID;
}

function isReaderInfoEditionRole(roleId: string, roleLabel: string): boolean {
  if (roleId === INFO_EDITION_V1_PUBLISH_ROLE_ID) return true;
  if (roleId === INFO_EDITION_V1_EN_ROLE_ID) return true;
  return /^基础版|^讲解版/.test(roleLabel.trim());
}

function isReaderGuideEditionRole(roleId: string, roleLabel: string): boolean {
  if (roleId === INFO_EDITION_GUIDE_V2_ROLE_ID) return true;
  if (roleId === INFO_EDITION_GUIDE_V2_EN_ROLE_ID) return true;
  return (GUIDE_V2_ROLE_LABEL_ALIASES as readonly string[]).includes(roleLabel.trim());
}

function publishedChapterMatchesReaderRole(
  ch: Pick<InfoEditionV1PublishedChapter, "roleId" | "roleLabel">,
  targetRoleId: string,
  variant: InfoEditionReaderVariant,
): boolean {
  if (ch.roleId === targetRoleId) return true;
  if (variant === "info") return isReaderInfoEditionRole(ch.roleId, ch.roleLabel);
  return isReaderGuideEditionRole(ch.roleId, ch.roleLabel);
}

export function loadBundledInfoEditionChapter(
  bookId: string,
  chapter: number,
  variant: InfoEditionReaderVariant,
  opts?: { roleId?: string | null },
): InfoEditionV1PublishedChapter | null {
  const roles = Array.isArray(rolesFile.roles) ? rolesFile.roles : [];
  const explicitRoleId = opts?.roleId?.trim();
  const targetRoleId = explicitRoleId || readerVariantToRoleId(variant, roles);
  const readerKey = infoEditionReaderChapterKey(bookId, chapter, targetRoleId);
  const fromReaderKey = publishedFile.chapters[readerKey];
  if (fromReaderKey?.markdown?.trim()) return fromReaderKey;

  const legacyKey = infoEditionChapterKey(bookId, chapter);
  const legacy = publishedFile.chapters[legacyKey];
  if (explicitRoleId) {
    if (legacy?.markdown?.trim() && legacy.roleId === explicitRoleId) {
      return legacy;
    }
    return null;
  }
  if (legacy?.markdown?.trim() && publishedChapterMatchesReaderRole(legacy, targetRoleId, variant)) {
    return legacy;
  }
  return null;
}
