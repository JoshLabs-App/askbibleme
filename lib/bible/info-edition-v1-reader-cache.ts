import {
  infoEditionChapterKey,
  INFO_EDITION_V1_PUBLISH_PROFILE_ID,
  INFO_EDITION_V1_PUBLISH_ROLE_ID,
} from "@/lib/bible/info-edition-v1-publish";
import {
  loadPublishedInfoEditionChapter,
  readInfoEditionV1PublishedSync,
  writeInfoEditionV1PublishedSync,
} from "@/lib/bible/info-edition-v1-published-store";
import type {
  InfoEditionV1ChapterCacheStatus,
  InfoEditionV1PublishedChapter,
} from "@/lib/bible/info-edition-v1-published-types";

const PENDING_STALE_MS = 8 * 60 * 1000;

export type InfoEditionV1ReaderCacheResponse = {
  status: InfoEditionV1ChapterCacheStatus;
  published?: InfoEditionV1PublishedChapter;
  error?: string;
};

export function getInfoEditionReaderCache(
  cwd: string,
  bookId: string,
  chapter: number,
): InfoEditionV1ReaderCacheResponse {
  const key = infoEditionChapterKey(bookId, chapter);
  const ready = loadPublishedInfoEditionChapter(cwd, bookId, chapter);
  if (ready?.markdown.trim()) {
    return { status: "ready", published: ready };
  }

  const file = readInfoEditionV1PublishedSync(cwd);
  const failed = file.failed?.[key];
  if (failed?.error) {
    return { status: "failed", error: failed.error };
  }

  const pending = file.pending?.[key];
  if (pending?.startedAt) {
    const age = Date.now() - new Date(pending.startedAt).getTime();
    if (age < PENDING_STALE_MS) {
      return { status: "pending" };
    }
  }

  return { status: "missing" };
}

/** 占位 pending；若已在 pending 且未过期则返回 false */
export function tryBeginInfoEditionPending(cwd: string, bookId: string, chapter: number): boolean {
  const key = infoEditionChapterKey(bookId, chapter);
  const file = readInfoEditionV1PublishedSync(cwd);
  const existing = file.pending?.[key];
  if (existing?.startedAt) {
    const age = Date.now() - new Date(existing.startedAt).getTime();
    if (age < PENDING_STALE_MS) return false;
  }
  const pending = { ...(file.pending ?? {}) };
  pending[key] = {
    bookId: bookId.trim().toUpperCase(),
    chapter,
    startedAt: new Date().toISOString(),
  };
  const failed = { ...(file.failed ?? {}) };
  delete failed[key];
  writeInfoEditionV1PublishedSync(cwd, {
    ...file,
    pending,
    failed,
  });
  return true;
}

export function clearInfoEditionPending(cwd: string, bookId: string, chapter: number): void {
  const key = infoEditionChapterKey(bookId, chapter);
  const file = readInfoEditionV1PublishedSync(cwd);
  if (!file.pending?.[key]) return;
  const pending = { ...file.pending };
  delete pending[key];
  writeInfoEditionV1PublishedSync(cwd, { ...file, pending });
}

export function setInfoEditionReaderFailed(
  cwd: string,
  bookId: string,
  chapter: number,
  error: string,
): void {
  const key = infoEditionChapterKey(bookId, chapter);
  const file = readInfoEditionV1PublishedSync(cwd);
  const failed = { ...(file.failed ?? {}) };
  failed[key] = {
    bookId: bookId.trim().toUpperCase(),
    chapter,
    error: error.trim() || "生成失败",
    failedAt: new Date().toISOString(),
  };
  const pending = { ...(file.pending ?? {}) };
  delete pending[key];
  writeInfoEditionV1PublishedSync(cwd, { ...file, pending, failed });
}

export function clearInfoEditionReaderFailed(cwd: string, bookId: string, chapter: number): void {
  const key = infoEditionChapterKey(bookId, chapter);
  const file = readInfoEditionV1PublishedSync(cwd);
  if (!file.failed?.[key]) return;
  const failed = { ...file.failed };
  delete failed[key];
  writeInfoEditionV1PublishedSync(cwd, { ...file, failed });
}

export function readerCacheMeta() {
  return {
    roleId: INFO_EDITION_V1_PUBLISH_ROLE_ID,
    profileId: INFO_EDITION_V1_PUBLISH_PROFILE_ID,
  };
}
