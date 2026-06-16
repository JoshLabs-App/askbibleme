import fs from "node:fs";
import path from "node:path";
import {
  infoEditionV3BatchLockPath,
  infoEditionV3BatchStatePath,
} from "@/lib/bible/info-edition-v3-batch-paths";

export const INFO_EDITION_V3_BATCH_STATE_VERSION = 1 as const;

export type InfoEditionV3BatchChapterStatus = "ok" | "failed" | "skipped" | "partial";

export type InfoEditionV3BatchChapterRecord = {
  status: InfoEditionV3BatchChapterStatus;
  infoPublished?: boolean;
  guidePublished?: boolean;
  critiqueChars?: number;
  error?: string;
  at?: string;
  durationSec?: number;
};

export type InfoEditionV3BatchBookState = {
  bookId: string;
  bookName: string;
  chapters: number;
  byChapter: Record<string, InfoEditionV3BatchChapterRecord>;
};

export type InfoEditionV3BatchState = {
  version: typeof INFO_EDITION_V3_BATCH_STATE_VERSION;
  startedAt: string;
  updatedAt: string;
  running: boolean;
  skipCorrected: boolean;
  force: boolean;
  cursor: {
    bookIndex: number;
    chapter: number;
  };
  books: Record<string, InfoEditionV3BatchBookState>;
  stats: {
    ok: number;
    failed: number;
    skipped: number;
    partial: number;
  };
  lastRun?: {
    bookId: string;
    chapter: number;
    at: string;
    error?: string;
    infoPublished?: boolean;
    guidePublished?: boolean;
  };
};

export { infoEditionV3BatchLockPath, infoEditionV3BatchStatePath };

function defaultState(): InfoEditionV3BatchState {
  const now = new Date().toISOString();
  return {
    version: INFO_EDITION_V3_BATCH_STATE_VERSION,
    startedAt: now,
    updatedAt: now,
    running: false,
    skipCorrected: true,
    force: false,
    cursor: { bookIndex: 0, chapter: 1 },
    books: {},
    stats: { ok: 0, failed: 0, skipped: 0, partial: 0 },
  };
}

function normalizeChapterRecord(raw: unknown): InfoEditionV3BatchChapterRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = o.status;
  if (status !== "ok" && status !== "failed" && status !== "skipped" && status !== "partial") {
    return null;
  }
  return {
    status,
    infoPublished: o.infoPublished === true,
    guidePublished: o.guidePublished === true,
    critiqueChars: typeof o.critiqueChars === "number" ? o.critiqueChars : undefined,
    error: typeof o.error === "string" ? o.error : undefined,
    at: typeof o.at === "string" ? o.at : undefined,
    durationSec: typeof o.durationSec === "number" ? o.durationSec : undefined,
  };
}

function normalizeState(raw: unknown): InfoEditionV3BatchState {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const stats = o.stats as InfoEditionV3BatchState["stats"] | undefined;
  const booksRaw = o.books && typeof o.books === "object" ? o.books : {};
  const books: Record<string, InfoEditionV3BatchBookState> = {};
  for (const [id, val] of Object.entries(booksRaw as Record<string, unknown>)) {
    if (!val || typeof val !== "object") continue;
    const row = val as Record<string, unknown>;
    const byChapterRaw = row.byChapter && typeof row.byChapter === "object" ? row.byChapter : {};
    const byChapter: Record<string, InfoEditionV3BatchChapterRecord> = {};
    for (const [ck, cv] of Object.entries(byChapterRaw as Record<string, unknown>)) {
      const rec = normalizeChapterRecord(cv);
      if (rec) byChapter[ck] = rec;
    }
    books[id] = {
      bookId: typeof row.bookId === "string" ? row.bookId : id,
      bookName: typeof row.bookName === "string" ? row.bookName : id,
      chapters: Number(row.chapters) || 0,
      byChapter,
    };
  }
  return {
    ...base,
    startedAt: typeof o.startedAt === "string" ? o.startedAt : base.startedAt,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : base.updatedAt,
    running: o.running === true,
    skipCorrected: typeof o.skipCorrected === "boolean" ? o.skipCorrected : base.skipCorrected,
    force: o.force === true,
    cursor:
      o.cursor && typeof o.cursor === "object"
        ? {
            bookIndex: Number((o.cursor as Record<string, unknown>).bookIndex) || 0,
            chapter: Number((o.cursor as Record<string, unknown>).chapter) || 1,
          }
        : base.cursor,
    books,
    stats: {
      ok: stats?.ok ?? 0,
      failed: stats?.failed ?? 0,
      skipped: stats?.skipped ?? 0,
      partial: stats?.partial ?? 0,
    },
    lastRun:
      o.lastRun && typeof o.lastRun === "object"
        ? (o.lastRun as InfoEditionV3BatchState["lastRun"])
        : undefined,
  };
}

export function readInfoEditionV3BatchState(cwd: string): InfoEditionV3BatchState {
  const p = infoEditionV3BatchStatePath(cwd);
  if (!fs.existsSync(p)) return defaultState();
  try {
    return normalizeState(JSON.parse(fs.readFileSync(p, "utf8")) as unknown);
  } catch {
    return defaultState();
  }
}

export function writeInfoEditionV3BatchState(cwd: string, state: InfoEditionV3BatchState): void {
  const p = infoEditionV3BatchStatePath(cwd);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const next = { ...state, updatedAt: new Date().toISOString() };
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, p);
}

export function ensureV3BookState(
  state: InfoEditionV3BatchState,
  bookId: string,
  bookName: string,
  chapters: number,
): InfoEditionV3BatchBookState {
  const id = bookId.trim().toUpperCase();
  if (!state.books[id]) {
    state.books[id] = { bookId: id, bookName, chapters, byChapter: {} };
  }
  return state.books[id];
}

export function setV3ChapterRecord(
  book: InfoEditionV3BatchBookState,
  chapter: number,
  record: InfoEditionV3BatchChapterRecord,
): void {
  book.byChapter[String(chapter)] = record;
}

export function recomputeV3BatchStats(state: InfoEditionV3BatchState): void {
  let ok = 0;
  let failed = 0;
  let skipped = 0;
  let partial = 0;
  for (const book of Object.values(state.books)) {
    for (const rec of Object.values(book.byChapter)) {
      if (rec.status === "ok") ok += 1;
      else if (rec.status === "failed") failed += 1;
      else if (rec.status === "skipped") skipped += 1;
      else if (rec.status === "partial") partial += 1;
    }
  }
  state.stats = { ok, failed, skipped, partial };
}

export function countV3BatchProgress(
  state: InfoEditionV3BatchState,
  totalChapters: number,
): {
  totalTasks: number;
  doneTasks: number;
  percent: number;
} {
  const totalTasks = totalChapters;
  let doneTasks = 0;
  for (const book of Object.values(state.books)) {
    for (const rec of Object.values(book.byChapter)) {
      if (rec.status === "ok" || rec.status === "skipped" || rec.status === "partial" || rec.status === "failed") {
        doneTasks += 1;
      }
    }
  }
  const percent = totalTasks > 0 ? Math.min(100, Math.round((doneTasks / totalTasks) * 100)) : 0;
  return { totalTasks, doneTasks, percent };
}
