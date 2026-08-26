"use client";

import {
  INFO_EDITION_GUIDE_V2_EN_ROLE_ID,
  INFO_EDITION_GUIDE_V2_ROLE_ID,
  INFO_EDITION_GUIDE_V2_ROLE_LABEL,
  INFO_EDITION_GUIDE_V2_EN_ROLE_LABEL,
  INFO_EDITION_V1_PUBLISH_ROLE_ID,
  type InfoEditionReaderVariant,
} from "@/lib/bible/info-edition-v1-publish";
import type { InfoEditionV1PublishedChapter } from "@/lib/bible/info-edition-v1-published-types";

const PUBLISHED_URL = "/read/info-edition-v1-published.json";
const ROLES_URL = "/read/generation-roles.json";

type PublishedFile = {
  chapters?: Record<string, InfoEditionV1PublishedChapter>;
};

type RolesFile = {
  roles?: { id: string; label: string }[];
};

const GUIDE_V2_ROLE_LABEL_ALIASES = [
  INFO_EDITION_GUIDE_V2_ROLE_LABEL,
  INFO_EDITION_GUIDE_V2_EN_ROLE_LABEL,
  "引导版V2",
  "引导版",
  "Guide V2",
  "Guide V2 EN",
] as const;

let publishedPromise: Promise<PublishedFile | null> | null = null;
let rolesPromise: Promise<RolesFile | null> | null = null;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function loadPublished(): Promise<PublishedFile | null> {
  if (!publishedPromise) publishedPromise = fetchJson<PublishedFile>(PUBLISHED_URL);
  return publishedPromise;
}

function loadRoles(): Promise<RolesFile | null> {
  if (!rolesPromise) rolesPromise = fetchJson<RolesFile>(ROLES_URL);
  return rolesPromise;
}

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
  if (roleId === "info_edition_v1_en") return true;
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

/** 网页：从 public/read 静态 published JSON 取导读（不经 /api/read/info-edition-v1）。 */
export async function fetchStaticInfoEditionChapter(
  bookId: string,
  chapter: number,
  variant: InfoEditionReaderVariant,
  opts?: { roleId?: string | null },
): Promise<InfoEditionV1PublishedChapter | null> {
  const [publishedFile, rolesFile] = await Promise.all([loadPublished(), loadRoles()]);
  const chapters = publishedFile?.chapters;
  if (!chapters) return null;

  const roles = Array.isArray(rolesFile?.roles) ? rolesFile.roles : [];
  const explicitRoleId = opts?.roleId?.trim();
  const targetRoleId = explicitRoleId || readerVariantToRoleId(variant, roles);
  const readerKey = infoEditionReaderChapterKey(bookId, chapter, targetRoleId);
  const fromReaderKey = chapters[readerKey];
  if (fromReaderKey?.markdown?.trim()) return fromReaderKey;

  const legacyKey = infoEditionChapterKey(bookId, chapter);
  const legacy = chapters[legacyKey];
  if (explicitRoleId) {
    if (legacy?.markdown?.trim() && legacy.roleId === explicitRoleId) return legacy;
    return null;
  }
  if (legacy?.markdown?.trim() && publishedChapterMatchesReaderRole(legacy, targetRoleId, variant)) {
    return legacy;
  }
  return null;
}
