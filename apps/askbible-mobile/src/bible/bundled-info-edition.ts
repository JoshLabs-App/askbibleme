import type { InfoEditionReaderVariant, InfoEditionV1PublishedChapter } from "./info-edition-types";
import { retryInfoEditionDatabaseOnPrepareError } from "./info-edition-database";

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

type GenerationRolesFile = {
  roles: { id: string; label: string }[];
};

/**
 * 正文改由 assets/content/info-edition.sqlite 按章查询。
 * 原先这里 `require()` 一份 22.5MB 的 JSON，一进读经页就同步解析全本 4761 章
 * （Hermes 实测 34ms、常驻约 27MB，手机更慢），解析期间 JS 线程阻塞、界面无响应。
 * roles 只有几 KB，仍随包 require。
 */
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

async function queryChapterByKey(key: string): Promise<InfoEditionV1PublishedChapter | null> {
  const row = await retryInfoEditionDatabaseOnPrepareError((db) =>
    db.getFirstAsync<{ payload: string }>("SELECT payload FROM chapter WHERE key = ? LIMIT 1", [key]),
  );
  const payload = row?.payload;
  if (!payload) return null;
  try {
    return JSON.parse(payload) as InfoEditionV1PublishedChapter;
  } catch {
    return null;
  }
}

/**
 * 查找顺序与改造前一致：先按「书卷:章:角色」精确取，取不到再退回旧式「书卷:章」键
 * 并校验角色是否匹配。只是数据来源从内存对象换成了按 key 查一行。
 */
export async function loadBundledInfoEditionChapter(
  bookId: string,
  chapter: number,
  variant: InfoEditionReaderVariant,
  opts?: { roleId?: string | null },
): Promise<InfoEditionV1PublishedChapter | null> {
  const roles = Array.isArray(rolesFile.roles) ? rolesFile.roles : [];
  const explicitRoleId = opts?.roleId?.trim();
  const targetRoleId = explicitRoleId || readerVariantToRoleId(variant, roles);

  const fromReaderKey = await queryChapterByKey(
    infoEditionReaderChapterKey(bookId, chapter, targetRoleId),
  );
  if (fromReaderKey?.markdown?.trim()) return fromReaderKey;

  const legacy = await queryChapterByKey(infoEditionChapterKey(bookId, chapter));
  if (explicitRoleId) {
    if (legacy?.markdown?.trim() && legacy.roleId === explicitRoleId) return legacy;
    return null;
  }
  if (legacy?.markdown?.trim() && publishedChapterMatchesReaderRole(legacy, targetRoleId, variant)) {
    return legacy;
  }
  return null;
}
