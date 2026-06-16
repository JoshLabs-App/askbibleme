import "server-only";
import {
  countV3BatchProgress,
  readInfoEditionV3BatchState,
} from "@/lib/bible/info-edition-v3-batch-state";
import {
  readV3BatchLockPid,
  readV3BatchLogTail,
  readV3BatchUiConfig,
  reconcileV3BatchRunningFlag,
} from "@/lib/bible/info-edition-v3-batch-runner";
import { scriptureBooks } from "@/lib/bible/scripture-books";

export function buildInfoEditionV3BatchStatusPayload(cwd: string) {
  const processAlive = reconcileV3BatchRunningFlag(cwd);
  const pid = readV3BatchLockPid(cwd);
  const state = readInfoEditionV3BatchState(cwd);
  const totalChapters = scriptureBooks.reduce((s, b) => s + b.chapters, 0);
  const progress = countV3BatchProgress(state, totalChapters);
  const config = readV3BatchUiConfig(cwd);

  const books = scriptureBooks.map((b) => {
    const row = state.books[b.bookId];
    let ok = 0;
    let failed = 0;
    let skipped = 0;
    let partial = 0;
    let pending = b.chapters;
    for (let c = 1; c <= b.chapters; c++) {
      const rec = row?.byChapter[String(c)];
      if (!rec) continue;
      pending -= 1;
      if (rec.status === "ok") ok += 1;
      else if (rec.status === "failed") failed += 1;
      else if (rec.status === "skipped") skipped += 1;
      else if (rec.status === "partial") partial += 1;
    }
    const done = ok + failed + skipped + partial;
    return {
      bookId: b.bookId,
      bookName: b.bookName,
      chapters: b.chapters,
      ok,
      failed,
      skipped,
      partial,
      pending,
      done,
      percent: b.chapters > 0 ? Math.round((done / b.chapters) * 100) : 0,
    };
  });

  const cursorBook = scriptureBooks[state.cursor.bookIndex];
  const lastBook = scriptureBooks[scriptureBooks.length - 1];
  const allDone = progress.doneTasks >= totalChapters;

  const recentChapters: {
    bookId: string;
    bookName: string;
    chapter: number;
    status: string;
    infoPublished?: boolean;
    guidePublished?: boolean;
    at?: string;
    error?: string;
    durationSec?: number;
  }[] = [];

  for (const book of scriptureBooks) {
    const row = state.books[book.bookId];
    if (!row) continue;
    for (const [chKey, rec] of Object.entries(row.byChapter)) {
      const chapter = Number(chKey);
      if (!Number.isInteger(chapter)) continue;
      recentChapters.push({
        bookId: book.bookId,
        bookName: book.bookName,
        chapter,
        status: rec.status,
        infoPublished: rec.infoPublished,
        guidePublished: rec.guidePublished,
        at: rec.at,
        error: rec.error,
        durationSec: rec.durationSec,
      });
    }
  }
  recentChapters.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return {
    ok: true as const,
    process: { pid, alive: processAlive },
    config,
    logTail: readV3BatchLogTail(cwd),
    state: {
      running: state.running,
      startedAt: state.startedAt,
      updatedAt: state.updatedAt,
      skipCorrected: state.skipCorrected,
      force: state.force,
      stats: state.stats,
      lastRun: state.lastRun ?? null,
      cursor: {
        bookIndex: state.cursor.bookIndex,
        bookId: cursorBook?.bookId ?? null,
        bookName: cursorBook?.bookName ?? null,
        chapter: state.cursor.chapter,
      },
    },
    progress: {
      totalChapters,
      doneChapters: progress.doneTasks,
      percent: progress.percent,
    },
    fullBible: {
      complete: allDone,
      endBookId: lastBook?.bookId ?? "REV",
      endBookName: lastBook?.bookName ?? "启示录",
      resumeBookId: cursorBook?.bookId ?? null,
      resumeBookName: cursorBook?.bookName ?? null,
      resumeChapter: state.cursor.chapter,
      stateRel: "data/bible/info-edition-v3-batch-state.json",
      publishedRel: "data/bible/info-edition-v1-published.json",
    },
    books,
    recentChapters: recentChapters.slice(0, 48),
  };
}
