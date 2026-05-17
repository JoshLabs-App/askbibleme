import fs from "node:fs";
import path from "node:path";
import type { InfoEditionReaderVariant } from "@/lib/bible/info-edition-v1-publish";

export const INFO_EDITION_BATCH_STATE_VERSION = 1 as const;
export const INFO_EDITION_BATCH_STATE_REL = path.join(
  "data",
  "bible",
  "info-edition-v1-batch-state.json",
);
export const INFO_EDITION_BATCH_LOCK_REL = path.join("data", "bible", "info-edition-v1-batch.lock");

export type InfoEditionBatchChapterStatus = "ok" | "failed" | "skipped";

export type InfoEditionBatchBookState = {
  bookId: string;
  bookName: string;
  chapters: number;
  /** chapter → edition → status */
  byChapter: Record<string, Partial<Record<InfoEditionReaderVariant, InfoEditionBatchChapterStatus>>>;
  /** 该卷已全部完成且已推送到线上磁盘 */
  syncedAt?: string;
  lastSyncError?: string;
};

export type InfoEditionBatchState = {
  version: typeof INFO_EDITION_BATCH_STATE_VERSION;
  startedAt: string;
  updatedAt: string;
  running: boolean;
  editions: InfoEditionReaderVariant[];
  skipExisting: boolean;
  force: boolean;
  cursor: {
    bookIndex: number;
    chapter: number;
    editionIndex: number;
  };
  books: Record<string, InfoEditionBatchBookState>;
  stats: {
    ok: number;
    failed: number;
    skipped: number;
  };
  lastRun?: {
    bookId: string;
    chapter: number;
    edition: InfoEditionReaderVariant;
    at: string;
    error?: string;
  };
};

export function infoEditionBatchStatePath(cwd: string): string {
  return path.join(cwd, INFO_EDITION_BATCH_STATE_REL);
}

export function infoEditionBatchLockPath(cwd: string): string {
  return path.join(cwd, INFO_EDITION_BATCH_LOCK_REL);
}

function defaultState(editions: InfoEditionReaderVariant[]): InfoEditionBatchState {
  const now = new Date().toISOString();
  return {
    version: INFO_EDITION_BATCH_STATE_VERSION,
    startedAt: now,
    updatedAt: now,
    running: false,
    editions,
    skipExisting: true,
    force: false,
    cursor: { bookIndex: 0, chapter: 1, editionIndex: 0 },
    books: {},
    stats: { ok: 0, failed: 0, skipped: 0 },
  };
}

function normalizeState(raw: unknown, editions: InfoEditionReaderVariant[]): InfoEditionBatchState {
  const base = defaultState(editions);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const stats = o.stats as InfoEditionBatchState["stats"] | undefined;
  return {
    ...base,
    version: INFO_EDITION_BATCH_STATE_VERSION,
    startedAt: typeof o.startedAt === "string" ? o.startedAt : base.startedAt,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : base.updatedAt,
    running: o.running === true,
    editions: Array.isArray(o.editions)
      ? (o.editions.filter((e) => e === "info" || e === "guide") as InfoEditionReaderVariant[])
      : editions,
    skipExisting: typeof o.skipExisting === "boolean" ? o.skipExisting : base.skipExisting,
    force: o.force === true,
    cursor:
      o.cursor && typeof o.cursor === "object"
        ? {
            bookIndex: Number((o.cursor as Record<string, unknown>).bookIndex) || 0,
            chapter: Number((o.cursor as Record<string, unknown>).chapter) || 1,
            editionIndex: Number((o.cursor as Record<string, unknown>).editionIndex) || 0,
          }
        : base.cursor,
    books: (o.books && typeof o.books === "object" ? o.books : {}) as InfoEditionBatchState["books"],
    stats: {
      ok: stats?.ok ?? 0,
      failed: stats?.failed ?? 0,
      skipped: stats?.skipped ?? 0,
    },
    lastRun:
      o.lastRun && typeof o.lastRun === "object"
        ? (o.lastRun as InfoEditionBatchState["lastRun"])
        : undefined,
  };
}

export function readInfoEditionBatchState(
  cwd: string,
  editions: InfoEditionReaderVariant[],
): InfoEditionBatchState {
  const p = infoEditionBatchStatePath(cwd);
  if (!fs.existsSync(p)) return defaultState(editions);
  try {
    return normalizeState(JSON.parse(fs.readFileSync(p, "utf8")) as unknown, editions);
  } catch {
    return defaultState(editions);
  }
}

export function writeInfoEditionBatchState(cwd: string, state: InfoEditionBatchState): void {
  const p = infoEditionBatchStatePath(cwd);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const next = { ...state, updatedAt: new Date().toISOString() };
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, p);
}

export function ensureBookState(
  state: InfoEditionBatchState,
  bookId: string,
  bookName: string,
  chapters: number,
): InfoEditionBatchBookState {
  const id = bookId.trim().toUpperCase();
  if (!state.books[id]) {
    state.books[id] = { bookId: id, bookName, chapters, byChapter: {} };
  }
  return state.books[id];
}

export function setChapterStatus(
  book: InfoEditionBatchBookState,
  chapter: number,
  edition: InfoEditionReaderVariant,
  status: InfoEditionBatchChapterStatus,
): void {
  const key = String(chapter);
  if (!book.byChapter[key]) book.byChapter[key] = {};
  book.byChapter[key][edition] = status;
}

export function countBatchProgress(
  state: InfoEditionBatchState,
  totalChapters: number,
): {
  totalTasks: number;
  doneTasks: number;
  percent: number;
  booksComplete: number;
  booksSynced: number;
} {
  const editions = state.editions.length || 1;
  const totalTasks = totalChapters * editions;
  let doneTasks = 0;
  let booksComplete = 0;
  let booksSynced = 0;
  for (const book of Object.values(state.books)) {
    let bookDone = 0;
    for (let c = 1; c <= book.chapters; c++) {
      const row = book.byChapter[String(c)];
      for (const ed of state.editions) {
        const st = row?.[ed];
        if (st === "ok" || st === "skipped") {
          doneTasks += 1;
          bookDone += 1;
        }
      }
    }
    if (bookDone >= book.chapters * editions) booksComplete += 1;
    if (book.syncedAt) booksSynced += 1;
  }
  const percent = totalTasks > 0 ? Math.min(100, Math.round((doneTasks / totalTasks) * 100)) : 0;
  return { totalTasks, doneTasks, percent, booksComplete, booksSynced };
}
