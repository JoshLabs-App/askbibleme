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
  infoEditionWritableBibleDir,
  isInfoEditionDiskSaveEnabled,
  isInfoEditionProductionDiskConfigured,
} from "@/lib/bible/info-edition-published-path";
import { isSupabaseServiceConfigured } from "@/lib/supabase/service";
import type { InfoEditionV1ReaderCacheResponse } from "@/lib/bible/info-edition-v1-reader-cache";

export type InfoEditionReaderPersistence = "disk" | "supabase" | "none";

export { isInfoEditionDiskSaveEnabled };

export function getInfoEditionReaderPersistence(cwd = process.cwd()): InfoEditionReaderPersistence {
  if (isInfoEditionDiskSaveEnabled() && infoEditionWritableBibleDir(cwd)) {
    return "disk";
  }
  if (isSupabaseServiceConfigured()) {
    return "supabase";
  }
  return "none";
}

export function isInfoEditionReaderGenerateAllowed(): boolean {
  if (getInfoEditionReaderPersistence() === "none") return false;
  if (!isInfoEditionProductionDiskConfigured()) return false;
  return true;
}

export function infoEditionReaderGenerateBlockedReason(): string | null {
  if (getInfoEditionReaderPersistence() === "none") {
    return "本章导读生成未启用：Render 请挂载 Disk（如 /mnt/data），并设 INFO_EDITION_DISK_SAVE=1、DATA_ROOT=/mnt/data、AI_API_KEY。";
  }
  if (!isInfoEditionProductionDiskConfigured()) {
    return "生产环境缺少 DATA_ROOT 或 INFO_EDITION_DATA_DIR，无法写入导读缓存（请指向 Render 持久磁盘，如 /mnt/data）。";
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
