import "server-only";
import {
  infoEditionExternalDataRoot,
  isInfoEditionDiskSaveEnabled,
  isInfoEditionProductionDiskConfigured,
  isInfoEditionWritableDiskAvailable,
} from "@/lib/bible/info-edition-published-path";
import { isSelahOnlineEditorSurfaceAllowed } from "@/lib/selah-online-editor-surface";

/** 是否允许在服务器上启停全本批量（临时运维；仅 CLI 触发，无后台入口） */
export function isInfoEditionOnlineBatchEnabled(): boolean {
  return process.env.INFO_EDITION_BATCH_ONLINE === "1";
}

/** 批量结果直接写入挂载盘（如 Render `/var/data`），无需 scp */
export function isInfoEditionBatchOnProductionDisk(cwd: string): boolean {
  const root = infoEditionExternalDataRoot();
  if (!root || !isInfoEditionDiskSaveEnabled()) return false;
  return isInfoEditionWritableDiskAvailable(cwd);
}

export function infoEditionOnlineBatchBlockedReason(cwd: string): string | null {
  if (!isSelahOnlineEditorSurfaceAllowed()) {
    return "当前部署未开放管理 API（Vercel Production 需 SELAH_ALLOW_ADMIN_IN_PRODUCTION=1）。";
  }
  if (!isInfoEditionOnlineBatchEnabled()) {
    return "未启用线上批量：请在环境变量设置 INFO_EDITION_BATCH_ONLINE=1，跑完后改回 0 并重新部署。";
  }
  if (process.env.NODE_ENV === "production" && !isInfoEditionProductionDiskConfigured()) {
    return "生产环境须配置 INFO_EDITION_DISK_SAVE=1 与 DATA_ROOT（持久盘挂载路径）。";
  }
  if (!isInfoEditionWritableDiskAvailable(cwd)) {
    return "持久盘不可写：请确认 DATA_ROOT 与 Render Disks Mount Path 一致，且实例数为 1。";
  }
  return null;
}
