import fs from "node:fs";
import path from "node:path";
import {
  generationToPublishedChapter,
  infoEditionChapterKey,
  INFO_EDITION_V1_PUBLISH_PROFILE_ID,
  INFO_EDITION_V1_PUBLISH_ROLE_ID,
  pickPublishedGeneration,
} from "@/lib/bible/info-edition-v1-publish";
import type { InfoEditionV1Generation } from "@/lib/bible/info-edition-v1-types";
import type {
  InfoEditionV1PublishedChapter,
  InfoEditionV1PublishedFile,
} from "@/lib/bible/info-edition-v1-published-types";
import { INFO_EDITION_V1_PUBLISHED_VERSION } from "@/lib/bible/info-edition-v1-published-types";
import {
  infoEditionBundledPublishedPath,
  infoEditionWritablePublishedPath,
} from "@/lib/bible/info-edition-published-path";

function readJsonFile(file: string): InfoEditionV1PublishedFile | null {
  if (!fs.existsSync(file)) return null;
  try {
    return normalizeFile(JSON.parse(fs.readFileSync(file, "utf8")) as unknown);
  } catch {
    return null;
  }
}

function mergePublishedFiles(
  base: InfoEditionV1PublishedFile,
  overlay: InfoEditionV1PublishedFile,
): InfoEditionV1PublishedFile {
  return {
    ...base,
    defaultRoleId: overlay.defaultRoleId || base.defaultRoleId,
    defaultProfileId: overlay.defaultProfileId || base.defaultProfileId,
    chapters: { ...base.chapters, ...overlay.chapters },
    pending: { ...base.pending, ...overlay.pending },
    failed: { ...base.failed, ...overlay.failed },
  };
}

function defaultFile(): InfoEditionV1PublishedFile {
  return {
    version: INFO_EDITION_V1_PUBLISHED_VERSION,
    defaultRoleId: INFO_EDITION_V1_PUBLISH_ROLE_ID,
    defaultProfileId: INFO_EDITION_V1_PUBLISH_PROFILE_ID,
    chapters: {},
  };
}

function normalizeChapter(raw: unknown): InfoEditionV1PublishedChapter | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const bookId = typeof o.bookId === "string" ? o.bookId.trim().toUpperCase() : "";
  const chapter = Number(o.chapter);
  const markdown = typeof o.markdown === "string" ? o.markdown.trim() : "";
  if (!bookId || !Number.isInteger(chapter) || chapter < 1 || !markdown) return null;
  return {
    bookId,
    chapter,
    roleId: typeof o.roleId === "string" ? o.roleId : INFO_EDITION_V1_PUBLISH_ROLE_ID,
    roleLabel: typeof o.roleLabel === "string" ? o.roleLabel : "基础版",
    profileId: typeof o.profileId === "string" ? o.profileId : INFO_EDITION_V1_PUBLISH_PROFILE_ID,
    profileName: typeof o.profileName === "string" ? o.profileName : "DeepSeek",
    markdown,
    charCount: typeof o.charCount === "number" ? o.charCount : markdown.length,
    publishedAt: typeof o.publishedAt === "string" ? o.publishedAt : new Date().toISOString(),
  };
}

function normalizePending(
  raw: unknown,
): InfoEditionV1PublishedFile["pending"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: NonNullable<InfoEditionV1PublishedFile["pending"]> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object") continue;
    const o = val as Record<string, unknown>;
    const bookId = typeof o.bookId === "string" ? o.bookId.trim().toUpperCase() : "";
    const chapter = Number(o.chapter);
    const startedAt = typeof o.startedAt === "string" ? o.startedAt.trim() : "";
    if (!bookId || !Number.isInteger(chapter) || chapter < 1 || !startedAt) continue;
    out[key] = { bookId, chapter, startedAt };
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeFailed(
  raw: unknown,
): InfoEditionV1PublishedFile["failed"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: NonNullable<InfoEditionV1PublishedFile["failed"]> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object") continue;
    const o = val as Record<string, unknown>;
    const bookId = typeof o.bookId === "string" ? o.bookId.trim().toUpperCase() : "";
    const chapter = Number(o.chapter);
    const error = typeof o.error === "string" ? o.error.trim() : "";
    const failedAt = typeof o.failedAt === "string" ? o.failedAt.trim() : "";
    if (!bookId || !Number.isInteger(chapter) || chapter < 1 || !error) continue;
    out[key] = {
      bookId,
      chapter,
      error,
      failedAt: failedAt || new Date().toISOString(),
    };
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeFile(raw: unknown): InfoEditionV1PublishedFile {
  if (!raw || typeof raw !== "object") return defaultFile();
  const o = raw as Record<string, unknown>;
  const chaptersRaw = o.chapters && typeof o.chapters === "object" ? o.chapters : {};
  const chapters: Record<string, InfoEditionV1PublishedChapter> = {};
  for (const [key, val] of Object.entries(chaptersRaw as Record<string, unknown>)) {
    const ch = normalizeChapter(val);
    if (ch) chapters[key] = ch;
  }
  return {
    version: INFO_EDITION_V1_PUBLISHED_VERSION,
    defaultRoleId:
      typeof o.defaultRoleId === "string" ? o.defaultRoleId : INFO_EDITION_V1_PUBLISH_ROLE_ID,
    defaultProfileId:
      typeof o.defaultProfileId === "string" ? o.defaultProfileId : INFO_EDITION_V1_PUBLISH_PROFILE_ID,
    chapters,
    pending: normalizePending(o.pending),
    failed: normalizeFailed(o.failed),
  };
}

export function readInfoEditionV1PublishedSync(cwd: string): InfoEditionV1PublishedFile {
  const bundled = readJsonFile(infoEditionBundledPublishedPath(cwd)) ?? defaultFile();
  const writable = infoEditionWritablePublishedPath(cwd);
  if (!writable || writable === infoEditionBundledPublishedPath(cwd)) {
    return bundled;
  }
  const overlay = readJsonFile(writable);
  if (!overlay) return bundled;
  return mergePublishedFiles(bundled, overlay);
}

export function writeInfoEditionV1PublishedSync(cwd: string, next: InfoEditionV1PublishedFile): void {
  const file = infoEditionWritablePublishedPath(cwd);
  if (!file) {
    throw new Error(
      "导读缓存不可写：生产环境请设置 INFO_EDITION_DISK_SAVE=1，并设置 DATA_ROOT 或 INFO_EDITION_DATA_DIR 为持久磁盘路径（如 /mnt/data）。",
    );
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(normalizeFile(next), null, 2)}\n`, "utf8");
}

export function loadPublishedInfoEditionChapter(
  cwd: string,
  bookId: string,
  chapter: number,
): InfoEditionV1PublishedChapter | null {
  const file = readInfoEditionV1PublishedSync(cwd);
  const key = infoEditionChapterKey(bookId, chapter);
  return file.chapters[key] ?? null;
}

/** 将对比结果中的「基础版 + DeepSeek」写入发布文件，供前台读经页读取 */
export function publishInfoEditionFromGenerations(
  cwd: string,
  bookId: string,
  chapter: number,
  generations: InfoEditionV1Generation[],
): InfoEditionV1PublishedChapter | null {
  const picked = pickPublishedGeneration(generations);
  if (!picked) return null;
  const now = new Date().toISOString();
  const entry = generationToPublishedChapter(bookId, chapter, picked, now);
  const file = readInfoEditionV1PublishedSync(cwd);
  const key = infoEditionChapterKey(bookId, chapter);
  file.chapters[key] = entry;
  if (file.pending?.[key]) {
    const pending = { ...file.pending };
    delete pending[key];
    file.pending = pending;
  }
  if (file.failed?.[key]) {
    const failed = { ...file.failed };
    delete failed[key];
    file.failed = failed;
  }
  writeInfoEditionV1PublishedSync(cwd, file);
  return entry;
}
