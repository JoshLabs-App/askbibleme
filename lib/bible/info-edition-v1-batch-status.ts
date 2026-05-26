import "server-only";
import {
  countBatchProgress,
  readInfoEditionBatchState,
} from "@/lib/bible/info-edition-v1-batch-state";
import {
  isInfoEditionBatchOnProductionDisk,
  isInfoEditionOnlineBatchEnabled,
} from "@/lib/bible/info-edition-batch-access";
import {
  readBatchLogTail,
  readBatchLockPid,
  readBatchUiConfig,
  reconcileBatchRunningFlag,
} from "@/lib/bible/info-edition-v1-batch-runner";
import { loadPublishedInfoEditionChapter } from "@/lib/bible/info-edition-v1-published-store";
import {
  INFO_EDITION_GUIDE_V2_ROLE_ID,
  INFO_EDITION_V1_PUBLISH_ROLE_ID,
  type InfoEditionReaderVariant,
} from "@/lib/bible/info-edition-v1-publish";
import { readInfoEditionV1PublishedSync } from "@/lib/bible/info-edition-v1-published-store";
import { readInvalidPublishedScanCache } from "@/lib/bible/info-edition-invalid-scan-cache";
import { scriptureBooks } from "@/lib/bible/scripture-books";

export function buildInfoEditionBatchStatusPayload(cwd: string) {
  const editions: InfoEditionReaderVariant[] = ["info", "guide"];
  const processAlive = reconcileBatchRunningFlag(cwd);
  const pid = readBatchLockPid(cwd);
  const state = readInfoEditionBatchState(cwd, editions);
  const totalChapters = scriptureBooks.reduce((s, b) => s + b.chapters, 0);
  const progress = countBatchProgress(state, totalChapters);
  const config = readBatchUiConfig(cwd);
  const directDisk = isInfoEditionBatchOnProductionDisk(cwd);
  const published = readInfoEditionV1PublishedSync(cwd);
  const targetInfoRoleId = config.infoRoleId || INFO_EDITION_V1_PUBLISH_ROLE_ID;
  const targetGuideRoleId = config.guideRoleId || INFO_EDITION_GUIDE_V2_ROLE_ID;

  const coverageByBook: Record<string, { info: Set<number>; guide: Set<number> }> = {};
  for (const b of scriptureBooks) {
    coverageByBook[b.bookId] = { info: new Set<number>(), guide: new Set<number>() };
  }
  for (const chapter of Object.values(published.chapters)) {
    const bucket = coverageByBook[chapter.bookId];
    if (!bucket) continue;
    if (chapter.roleId === targetInfoRoleId) bucket.info.add(chapter.chapter);
    if (chapter.roleId === targetGuideRoleId) bucket.guide.add(chapter.chapter);
  }

  const books = scriptureBooks.map((b) => {
    const row = state.books[b.bookId];
    let done = 0;
    for (let c = 1; c <= b.chapters; c++) {
      const ch = row?.byChapter[String(c)];
      for (const ed of state.editions) {
        if (ch?.[ed] === "ok" || ch?.[ed] === "skipped") done += 1;
      }
    }
    const total = b.chapters * state.editions.length;
    return {
      bookId: b.bookId,
      bookName: b.bookName,
      chapters: b.chapters,
      done,
      total,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      syncedAt: row?.syncedAt ?? null,
      lastSyncError: row?.lastSyncError ?? null,
    };
  });

  const targetBooks = scriptureBooks.map((b) => {
    const cov = coverageByBook[b.bookId];
    const infoHave = cov?.info.size ?? 0;
    const guideHave = cov?.guide.size ?? 0;
    const infoMissing = Math.max(0, b.chapters - infoHave);
    const guideMissing = Math.max(0, b.chapters - guideHave);
    const doneTasks = infoHave + guideHave;
    const totalTasks = b.chapters * 2;
    return {
      bookId: b.bookId,
      bookName: b.bookName,
      chapters: b.chapters,
      infoHave,
      guideHave,
      infoMissing,
      guideMissing,
      doneTasks,
      totalTasks,
      percent: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    };
  });
  const infoDone = targetBooks.reduce((sum, b) => sum + b.infoHave, 0);
  const guideDone = targetBooks.reduce((sum, b) => sum + b.guideHave, 0);
  const targetTotalTasks = totalChapters * 2;
  const targetDoneTasks = infoDone + guideDone;
  const targetProgress = {
    totalTasks: targetTotalTasks,
    doneTasks: targetDoneTasks,
    missingTasks: Math.max(0, targetTotalTasks - targetDoneTasks),
    percent: targetTotalTasks > 0 ? Math.min(100, Math.round((targetDoneTasks / targetTotalTasks) * 100)) : 0,
    totalChapters,
    info: {
      roleId: targetInfoRoleId,
      doneChapters: infoDone,
      missingChapters: Math.max(0, totalChapters - infoDone),
      percent: totalChapters > 0 ? Math.min(100, Math.round((infoDone / totalChapters) * 100)) : 0,
    },
    guide: {
      roleId: targetGuideRoleId,
      doneChapters: guideDone,
      missingChapters: Math.max(0, totalChapters - guideDone),
      percent: totalChapters > 0 ? Math.min(100, Math.round((guideDone / totalChapters) * 100)) : 0,
    },
  };

  const cursorBook = scriptureBooks[state.cursor.bookIndex];
  const lastBook = scriptureBooks[scriptureBooks.length - 1];
  const fullBibleComplete = targetProgress.percent >= 100;

  const invalidScan = readInvalidPublishedScanCache(cwd);

  return {
    ok: true as const,
    onlineBatchEnabled: isInfoEditionOnlineBatchEnabled(),
    directDisk,
    fullBible: {
      complete: fullBibleComplete,
      endBookId: lastBook?.bookId ?? "REV",
      endBookName: lastBook?.bookName ?? "启示录",
      resumeBookId: cursorBook?.bookId ?? null,
      resumeBookName: cursorBook?.bookName ?? null,
      resumeChapter: state.cursor.chapter,
      resumeEdition: state.editions[state.cursor.editionIndex] ?? "info",
      publishedRel: "data/bible/info-edition-v1-published.json",
    },
    process: { pid, alive: processAlive },
    config,
    logTail: readBatchLogTail(cwd),
    state: {
      running: state.running,
      startedAt: state.startedAt,
      updatedAt: state.updatedAt,
      skipExisting: state.skipExisting,
      force: state.force,
      editions: state.editions,
      stats: state.stats,
      lastRun: state.lastRun ?? null,
      cursor: {
        bookIndex: state.cursor.bookIndex,
        bookId: cursorBook?.bookId ?? null,
        bookName: cursorBook?.bookName ?? null,
        chapter: state.cursor.chapter,
        edition: state.editions[state.cursor.editionIndex] ?? "info",
      },
    },
    progress: targetProgress,
    batchProgress: progress,
    targetBooks,
    invalidChapters: invalidScan ?? { count: 0, sample: [], at: null },
    books,
    sample: state.lastRun
      ? {
          info: loadPublishedInfoEditionChapter(cwd, state.lastRun.bookId, state.lastRun.chapter, {
            roleId: INFO_EDITION_V1_PUBLISH_ROLE_ID,
            variant: "info",
          }),
          guide: loadPublishedInfoEditionChapter(cwd, state.lastRun.bookId, state.lastRun.chapter, {
            roleId: INFO_EDITION_GUIDE_V2_ROLE_ID,
            variant: "guide",
          }),
        }
      : null,
  };
}
