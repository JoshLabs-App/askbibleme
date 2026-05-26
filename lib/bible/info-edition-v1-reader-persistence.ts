import "server-only";
import {
  loadPublishedInfoEditionChapter,
  publishInfoEditionFromGenerations,
} from "@/lib/bible/info-edition-v1-published-store";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import type {
  InfoEditionV1PublishedChapter,
} from "@/lib/bible/info-edition-v1-published-types";
import { readGenerationRolesSync } from "@/lib/admin/generation-roles-store";
import {
  parseInfoEditionReaderVariant,
  readerVariantFromRole,
  readerVariantToRoleId,
  type InfoEditionReaderVariant,
} from "@/lib/bible/info-edition-v1-publish";
import {
  clearInfoEditionPending as clearPendingDisk,
  getInfoEditionReaderCache as getCacheDisk,
  setInfoEditionReaderFailed as setFailedDisk,
  tryBeginInfoEditionPending as tryBeginDisk,
} from "@/lib/bible/info-edition-v1-reader-cache";
import {
  formatInfoEditionDiskWriteError,
  infoEditionWritableBibleDir,
  isInfoEditionDiskSaveEnabled,
  isInfoEditionDiskSaveMisconfiguredInProduction,
  isInfoEditionProductionDiskConfigured,
  isInfoEditionWritableDiskAvailable,
  isRenderDeployment,
  isVercelDeployment,
} from "@/lib/bible/info-edition-published-path";
import type { InfoEditionV1ReaderCacheResponse } from "@/lib/bible/info-edition-v1-reader-cache";

export type InfoEditionReaderPersistence = "disk" | "none";

export type ResolvedInfoEditionReaderTarget = {
  variant: InfoEditionReaderVariant;
  roleId: string;
};

export function resolveInfoEditionReaderTarget(
  cwd: string,
  opts: { edition?: string | null; roleId?: string | null },
): ResolvedInfoEditionReaderTarget | { error: string } {
  const roles = readGenerationRolesSync(cwd).roles;
  const editionRaw = opts.edition?.trim() ?? "";
  const roleIdRaw = opts.roleId?.trim() ?? "";
  if (editionRaw && !parseInfoEditionReaderVariant(editionRaw)) {
    return { error: "无效的 edition（请使用 info 或 guide）。" };
  }
  const parsedVariant = parseInfoEditionReaderVariant(editionRaw);
  const variant = parsedVariant ?? "info";
  if (roleIdRaw) {
    const role = roles.find((it) => it.id === roleIdRaw);
    if (!role) {
      return { variant, roleId: readerVariantToRoleId(variant, roles) };
    }
    if (!parsedVariant) {
      return { variant: readerVariantFromRole(role), roleId: roleIdRaw };
    }
    const roleVariant = readerVariantFromRole(role);
    if (roleVariant !== variant) {
      return { variant, roleId: readerVariantToRoleId(variant, roles) };
    }
    return { variant, roleId: roleIdRaw };
  }
  return { variant, roleId: readerVariantToRoleId(variant, roles) };
}

export { isInfoEditionDiskSaveEnabled };

export function getInfoEditionReaderPersistence(cwd = process.cwd()): InfoEditionReaderPersistence {
  if (isInfoEditionWritableDiskAvailable(cwd)) {
    return "disk";
  }
  return "none";
}

export function isInfoEditionReaderGenerateAllowed(): boolean {
  const mode = getInfoEditionReaderPersistence();
  if (mode === "none") return false;
  if (mode === "disk" && !isInfoEditionProductionDiskConfigured()) return false;
  return true;
}

export function infoEditionReaderGenerateBlockedReason(cwd = process.cwd()): string | null {
  if (isInfoEditionDiskSaveMisconfiguredInProduction()) {
    return (
      "已开启 INFO_EDITION_DISK_SAVE，但未配置 DATA_ROOT / INFO_EDITION_DATA_DIR。" +
      " Render 请在后台挂载 Persistent Disk 并设 DATA_ROOT 为挂载路径（如 /var/data）。"
    );
  }

  if (
    isInfoEditionDiskSaveEnabled() &&
    infoEditionWritableBibleDir(cwd) &&
    !isInfoEditionWritableDiskAvailable(cwd)
  ) {
    const root = infoEditionWritableBibleDir(cwd);
    return formatInfoEditionDiskWriteError(
      `持久盘路径 ${root} 不存在或不可写。`,
    );
  }

  const mode = getInfoEditionReaderPersistence(cwd);
  if (mode === "none") {
    if (isRenderDeployment()) {
      const dataRoot =
        process.env.DATA_ROOT?.trim() || process.env.INFO_EDITION_DATA_DIR?.trim() || "";
      if (isInfoEditionDiskSaveEnabled() && dataRoot) {
        return (
          `已设 INFO_EDITION_DISK_SAVE=1 与 DATA_ROOT=${dataRoot}，但该路径尚不可写。` +
          " 请在 Render → 你的 Web Service → Disks：添加盘、Mount Path 必须与 DATA_ROOT 完全一致，保存后 Manual Deploy。" +
          " 并确认已设 AI_API_KEY、AI_BASE_URL、AI_MODEL。"
        );
      }
      return (
        "Render 磁盘方案：① Disks 的 Mount path 与 DATA_ROOT 一致（如 /var/data）；② INFO_EDITION_DISK_SAVE=1；" +
        "③ AI_API_KEY、AI_BASE_URL、AI_MODEL；④ Manual Deploy。"
      );
    }
    if (isVercelDeployment()) {
      return (
        "本章导读需持久存储：请启用 INFO_EDITION_DISK_SAVE，并确保 DATA_ROOT 可写，同时配置 AI_API_KEY。"
      );
    }
    return (
      "本章导读生成未启用：请配置持久磁盘（INFO_EDITION_DISK_SAVE=1、DATA_ROOT），并设置 AI_API_KEY / AI_BASE_URL / AI_MODEL。"
    );
  }
  if (mode === "disk" && !isInfoEditionProductionDiskConfigured()) {
    return "生产环境缺少 DATA_ROOT 或 INFO_EDITION_DATA_DIR（Render 请挂载 Persistent Disk 到同一路径，如 /var/data）。";
  }
  return null;
}

export async function getInfoEditionReaderCacheAsync(
  cwd: string,
  bookId: string,
  chapter: number,
  target: ResolvedInfoEditionReaderTarget,
): Promise<InfoEditionV1ReaderCacheResponse> {
  const bundled = loadPublishedInfoEditionChapter(cwd, bookId, chapter, {
    roleId: target.roleId,
    variant: target.variant,
  });
  if (bundled?.markdown.trim()) {
    return { status: "ready", published: bundled };
  }

  const mode = getInfoEditionReaderPersistence();
  if (mode === "disk") {
    return getCacheDisk(cwd, bookId, chapter, { roleId: target.roleId });
  }
  return { status: "missing" };
}

export async function tryBeginInfoEditionPendingAsync(
  cwd: string,
  bookId: string,
  chapter: number,
  target: ResolvedInfoEditionReaderTarget,
): Promise<boolean> {
  const mode = getInfoEditionReaderPersistence();
  if (mode === "disk") {
    return tryBeginDisk(cwd, bookId, chapter, { roleId: target.roleId });
  }
  return false;
}

export async function clearInfoEditionPendingAsync(
  cwd: string,
  bookId: string,
  chapter: number,
  target: ResolvedInfoEditionReaderTarget,
): Promise<void> {
  const mode = getInfoEditionReaderPersistence();
  if (mode === "disk") {
    clearPendingDisk(cwd, bookId, chapter, { roleId: target.roleId });
  }
}

export async function setInfoEditionReaderFailedAsync(
  cwd: string,
  bookId: string,
  chapter: number,
  error: string,
  target: ResolvedInfoEditionReaderTarget,
): Promise<void> {
  const mode = getInfoEditionReaderPersistence();
  if (mode === "disk") {
    setFailedDisk(cwd, bookId, chapter, error, { roleId: target.roleId });
  }
}

export async function publishInfoEditionFromGenerationsAsync(
  cwd: string,
  bookId: string,
  chapter: number,
  generations: InfoEditionV1Generation[],
  target: ResolvedInfoEditionReaderTarget,
): Promise<InfoEditionV1PublishedChapter | null> {
  const mode = getInfoEditionReaderPersistence();
  if (mode === "disk") {
    return publishInfoEditionFromGenerations(cwd, bookId, chapter, generations, {
      roleId: target.roleId,
    });
  }
  return null;
}
