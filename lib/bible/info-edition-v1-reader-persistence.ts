import "server-only";
import {
  loadPublishedInfoEditionChapter,
  publishInfoEditionFromGenerations,
} from "@/lib/bible/info-edition-v1-published-store";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import type {
  InfoEditionV1PublishedChapter,
} from "@/lib/bible/info-edition-v1-published-types";
import {
  clearInfoEditionPending as clearPendingDisk,
  getInfoEditionReaderCache as getCacheDisk,
  setInfoEditionReaderFailed as setFailedDisk,
  tryBeginInfoEditionPending as tryBeginDisk,
} from "@/lib/bible/info-edition-v1-reader-cache";
import {
  clearInfoEditionPendingSupabase,
  getInfoEditionReaderCacheSupabase,
  publishInfoEditionChapterSupabase,
  setInfoEditionReaderFailedSupabase,
  tryBeginInfoEditionPendingSupabase,
} from "@/lib/bible/info-edition-v1-published-supabase";
import {
  isInfoEditionDiskSaveEnabled,
  isInfoEditionDiskSaveMisconfiguredInProduction,
  isInfoEditionProductionDiskConfigured,
  isInfoEditionWritableDiskAvailable,
  isRenderDeployment,
  isVercelDeployment,
} from "@/lib/bible/info-edition-published-path";
import { isSupabaseServiceConfigured } from "@/lib/supabase/service";
import type { InfoEditionV1ReaderCacheResponse } from "@/lib/bible/info-edition-v1-reader-cache";

export type InfoEditionReaderPersistence = "disk" | "supabase" | "none";

export { isInfoEditionDiskSaveEnabled };

export function getInfoEditionReaderPersistence(cwd = process.cwd()): InfoEditionReaderPersistence {
  if (isInfoEditionWritableDiskAvailable(cwd)) {
    return "disk";
  }
  if (isSupabaseServiceConfigured()) {
    return "supabase";
  }
  return "none";
}

export function isInfoEditionReaderGenerateAllowed(): boolean {
  const mode = getInfoEditionReaderPersistence();
  if (mode === "none") return false;
  if (mode === "disk" && !isInfoEditionProductionDiskConfigured()) return false;
  return true;
}

export function infoEditionReaderGenerateBlockedReason(): string | null {
  if (isInfoEditionDiskSaveMisconfiguredInProduction()) {
    return (
      "已开启 INFO_EDITION_DISK_SAVE，但未配置 DATA_ROOT / INFO_EDITION_DATA_DIR。" +
      " Render 请在后台挂载 Persistent Disk 并设 DATA_ROOT=/mnt/data；或改用 Supabase + AI_API_KEY。"
    );
  }

  const mode = getInfoEditionReaderPersistence();
  if (mode === "none") {
    if (isRenderDeployment()) {
      return (
        "Render 上本章导读二选一：① Persistent Disk 挂载到 /mnt/data，并设 INFO_EDITION_DISK_SAVE=1、DATA_ROOT=/mnt/data；" +
        "② Supabase：NEXT_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY，并执行 migration/20260516000000_info_edition_v1_reader_cache.sql。" +
        " 两种方案均需 AI_API_KEY、AI_BASE_URL、AI_MODEL。"
      );
    }
    if (isVercelDeployment()) {
      return (
        "本章导读需 Supabase：NEXT_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY、migration，及 AI_API_KEY。" +
        " 请关闭 INFO_EDITION_DISK_SAVE。"
      );
    }
    return (
      "本章导读生成未启用：请配置 Supabase 或持久磁盘（INFO_EDITION_DISK_SAVE=1、DATA_ROOT），并设置 AI_API_KEY / AI_BASE_URL / AI_MODEL。"
    );
  }
  if (mode === "disk" && !isInfoEditionProductionDiskConfigured()) {
    return "生产环境缺少 DATA_ROOT 或 INFO_EDITION_DATA_DIR（Render 请挂载 Persistent Disk 到该路径，如 /mnt/data）。";
  }
  return null;
}

export async function getInfoEditionReaderCacheAsync(
  cwd: string,
  bookId: string,
  chapter: number,
): Promise<InfoEditionV1ReaderCacheResponse> {
  const bundled = loadPublishedInfoEditionChapter(cwd, bookId, chapter);
  if (bundled?.markdown.trim()) {
    return { status: "ready", published: bundled };
  }

  const mode = getInfoEditionReaderPersistence();
  if (mode === "supabase") {
    return getInfoEditionReaderCacheSupabase(bookId, chapter);
  }
  if (mode === "disk") {
    return getCacheDisk(cwd, bookId, chapter);
  }
  return { status: "missing" };
}

export async function tryBeginInfoEditionPendingAsync(
  cwd: string,
  bookId: string,
  chapter: number,
): Promise<boolean> {
  const mode = getInfoEditionReaderPersistence();
  if (mode === "supabase") {
    return tryBeginInfoEditionPendingSupabase(bookId, chapter);
  }
  if (mode === "disk") {
    return tryBeginDisk(cwd, bookId, chapter);
  }
  return false;
}

export async function clearInfoEditionPendingAsync(
  cwd: string,
  bookId: string,
  chapter: number,
): Promise<void> {
  const mode = getInfoEditionReaderPersistence();
  if (mode === "supabase") {
    await clearInfoEditionPendingSupabase(bookId, chapter);
    return;
  }
  if (mode === "disk") {
    clearPendingDisk(cwd, bookId, chapter);
  }
}

export async function setInfoEditionReaderFailedAsync(
  cwd: string,
  bookId: string,
  chapter: number,
  error: string,
): Promise<void> {
  const mode = getInfoEditionReaderPersistence();
  if (mode === "supabase") {
    await setInfoEditionReaderFailedSupabase(bookId, chapter, error);
    return;
  }
  if (mode === "disk") {
    setFailedDisk(cwd, bookId, chapter, error);
  }
}

export async function publishInfoEditionFromGenerationsAsync(
  cwd: string,
  bookId: string,
  chapter: number,
  generations: InfoEditionV1Generation[],
): Promise<InfoEditionV1PublishedChapter | null> {
  const mode = getInfoEditionReaderPersistence();
  if (mode === "supabase") {
    return publishInfoEditionChapterSupabase(bookId, chapter, generations);
  }
  if (mode === "disk") {
    return publishInfoEditionFromGenerations(cwd, bookId, chapter, generations);
  }
  return null;
}
