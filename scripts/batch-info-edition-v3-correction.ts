/**
 * V3 全本批量纠错：DeepSeek 找错 → 修订 V1/V2 → 逐章写入 published.json
 * 断点续跑：data/bible/info-edition-v3-batch-state.json
 *
 *   npm run info-edition:v3-batch
 *   INFO_EDITION_V3_BATCH_BOOK_START=GEN INFO_EDITION_V3_BATCH_BOOK_END=GEN npm run info-edition:v3-batch
 */
import fs from "node:fs";
import { readGenerationRolesSync } from "@/lib/admin/generation-roles-store";
import { infoEditionV3BatchLockPath } from "@/lib/bible/info-edition-v3-batch-paths";
import {
  ensureV3BookState,
  readInfoEditionV3BatchState,
  recomputeV3BatchStats,
  setV3ChapterRecord,
  writeInfoEditionV3BatchState,
  type InfoEditionV3BatchChapterRecord,
} from "@/lib/bible/info-edition-v3-batch-state";
import { loadInfoEditionV3ChapterSource } from "@/lib/bible/info-edition-v3-load-source";
import { resolveInfoEditionV3DeepSeek } from "@/lib/bible/info-edition-v3-resolve-deepseek";
import {
  INFO_EDITION_V3_CRITIQUE_ROLE_ID,
  INFO_EDITION_V3_REVISE_GUIDE_ROLE_ID,
  INFO_EDITION_V3_REVISE_INFO_ROLE_ID,
} from "@/lib/bible/info-edition-v3-correction-roles";
import { runInfoEditionV3CorrectionPipeline } from "@/lib/bible/info-edition-v3-run-correction";
import { scriptureBooks } from "@/lib/bible/scripture-books";

const cwd = process.cwd();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function acquireLock(): void {
  const lock = infoEditionV3BatchLockPath(cwd);
  if (fs.existsSync(lock)) {
    const pid = fs.readFileSync(lock, "utf8").trim();
    try {
      process.kill(Number(pid), 0);
      console.error(`Another V3 batch is running (PID ${pid}). Lock: ${lock}`);
      process.exit(1);
    } catch {
      /* stale */
    }
  }
  fs.writeFileSync(lock, String(process.pid), "utf8");
}

function releaseLock(): void {
  const lock = infoEditionV3BatchLockPath(cwd);
  try {
    if (fs.existsSync(lock)) fs.unlinkSync(lock);
  } catch {
    /* ignore */
  }
}

function bookIndexRange(): { start: number; end: number } {
  const startId = process.env.INFO_EDITION_V3_BATCH_BOOK_START?.trim().toUpperCase() || "";
  const endId = process.env.INFO_EDITION_V3_BATCH_BOOK_END?.trim().toUpperCase() || "";
  let start = 0;
  let end = scriptureBooks.length - 1;
  if (startId) {
    const i = scriptureBooks.findIndex((b) => b.bookId === startId);
    if (i >= 0) start = i;
  }
  if (endId) {
    const i = scriptureBooks.findIndex((b) => b.bookId === endId);
    if (i >= 0) end = i;
  }
  if (start > end) [start, end] = [end, start];
  return { start, end };
}

async function run(): Promise<void> {
  const force = process.env.INFO_EDITION_V3_BATCH_FORCE === "1";
  const skipCorrected = process.env.INFO_EDITION_V3_BATCH_SKIP_CORRECTED !== "0";
  const delayMs = Math.max(0, Number(process.env.INFO_EDITION_V3_BATCH_DELAY_MS || 1200));
  const { start: startBookIndex, end: endBookIndex } = bookIndexRange();

  const deepseek = resolveInfoEditionV3DeepSeek(cwd);
  if ("error" in deepseek) {
    console.error(deepseek.error);
    process.exit(1);
  }

  const rolesFile = readGenerationRolesSync(cwd);
  const roleIds = [
    INFO_EDITION_V3_CRITIQUE_ROLE_ID,
    INFO_EDITION_V3_REVISE_INFO_ROLE_ID,
    INFO_EDITION_V3_REVISE_GUIDE_ROLE_ID,
  ];
  const roles = roleIds
    .map((id) => rolesFile.roles.find((r) => r.id === id && r.enabled))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (roles.length < 3) {
    console.error("请在 generation-roles.json 启用 V3·找错诊断 / 修订讲解 / 修订发现。");
    process.exit(1);
  }

  acquireLock();
  let state = readInfoEditionV3BatchState(cwd);
  state.running = true;
  state.skipCorrected = skipCorrected;
  state.force = force;
  writeInfoEditionV3BatchState(cwd, state);

  let startChapter = state.cursor.chapter;
  let resumeBookIndex = state.cursor.bookIndex;
  if (resumeBookIndex < startBookIndex) resumeBookIndex = startBookIndex;
  if (resumeBookIndex > endBookIndex) {
    console.log("[v3-batch] 当前范围已全部处理，退出。");
    state.running = false;
    writeInfoEditionV3BatchState(cwd, state);
    releaseLock();
    return;
  }

  console.log(
    `[v3-batch] DeepSeek ${deepseek.settings.model} · 书卷 ${scriptureBooks[startBookIndex]?.bookId}–${scriptureBooks[endBookIndex]?.bookId} · skipCorrected=${skipCorrected} force=${force}`,
  );

  try {
    for (let bi = resumeBookIndex; bi <= endBookIndex && bi < scriptureBooks.length; bi++) {
      const book = scriptureBooks[bi];
      const bookState = ensureV3BookState(state, book.bookId, book.bookName, book.chapters);
      const chapterStart = bi === resumeBookIndex ? startChapter : 1;

      for (let ci = chapterStart; ci <= book.chapters; ci++) {
        const label = `${book.bookName} ${ci}章`;
        const existing = bookState.byChapter[String(ci)];

        if (!force && skipCorrected && existing?.status === "ok") {
          console.log(`[skip] ${label} · 已完成`);
          state.cursor = { bookIndex: bi, chapter: ci + 1 };
          if (ci >= book.chapters) state.cursor = { bookIndex: bi + 1, chapter: 1 };
          writeInfoEditionV3BatchState(cwd, state);
          continue;
        }

        const loaded = await loadInfoEditionV3ChapterSource(cwd, book.bookId, ci);
        if (!loaded.ok) {
          const rec: InfoEditionV3BatchChapterRecord = {
            status: "skipped",
            error: loaded.error,
            at: new Date().toISOString(),
          };
          setV3ChapterRecord(bookState, ci, rec);
          console.log(`[skip] ${label}: ${loaded.error}`);
          state.lastRun = { bookId: book.bookId, chapter: ci, at: rec.at!, error: loaded.error };
          state.cursor = { bookIndex: bi, chapter: ci + 1 };
          recomputeV3BatchStats(state);
          writeInfoEditionV3BatchState(cwd, state);
          continue;
        }

        if (!loaded.source.infoV1?.markdown.trim() && !loaded.source.guideV2?.markdown.trim()) {
          const rec: InfoEditionV3BatchChapterRecord = {
            status: "skipped",
            at: new Date().toISOString(),
            error: "无已发布讲解版或发现版",
          };
          setV3ChapterRecord(bookState, ci, rec);
          console.log(`[skip] ${label} · 无已发布稿`);
          state.lastRun = { bookId: book.bookId, chapter: ci, at: rec.at! };
          state.cursor = { bookIndex: bi, chapter: ci + 1 };
          recomputeV3BatchStats(state);
          writeInfoEditionV3BatchState(cwd, state);
          continue;
        }

        const t0 = Date.now();
        console.log(`[run] ${label} …`);

        const result = await runInfoEditionV3CorrectionPipeline(
          cwd,
          loaded.source,
          roles,
          deepseek.profile,
          deepseek.settings,
          { publish: true },
        );

        const durationSec = Math.round((Date.now() - t0) / 1000);
        const infoPublished = Boolean(result.publishedInfo);
        const guidePublished = Boolean(result.publishedGuide);
        const hasInfo = Boolean(loaded.source.infoV1?.markdown.trim());
        const hasGuide = Boolean(loaded.source.guideV2?.markdown.trim());

        let status: InfoEditionV3BatchChapterRecord["status"] = "ok";
        if (result.errors.length) {
          const anyPublished = infoPublished || guidePublished;
          status = anyPublished ? "partial" : "failed";
        }

        const rec: InfoEditionV3BatchChapterRecord = {
          status,
          infoPublished,
          guidePublished,
          critiqueChars: result.critique.charCount,
          error: result.errors.length ? result.errors.join("; ") : undefined,
          at: new Date().toISOString(),
          durationSec,
        };
        setV3ChapterRecord(bookState, ci, rec);

        if (status === "ok") {
          console.log(
            `[ok] ${label} (${durationSec}s, 诊断${result.critique.charCount}字${infoPublished ? ", 讲解✓" : hasInfo ? ", 讲解—" : ""}${guidePublished ? ", 发现✓" : hasGuide ? ", 发现—" : ""})`,
          );
        } else if (status === "partial") {
          console.error(`[partial] ${label} (${durationSec}s): ${rec.error}`);
        } else {
          console.error(`[fail] ${label} (${durationSec}s): ${rec.error ?? "未知错误"}`);
        }

        state.lastRun = {
          bookId: book.bookId,
          chapter: ci,
          at: rec.at!,
          error: rec.error,
          infoPublished,
          guidePublished,
        };
        state.cursor = { bookIndex: bi, chapter: ci + 1 };
        recomputeV3BatchStats(state);
        writeInfoEditionV3BatchState(cwd, state);

        if (delayMs > 0) await sleep(delayMs);
      }

      state.cursor = { bookIndex: bi + 1, chapter: 1 };
      writeInfoEditionV3BatchState(cwd, state);
    }

    state = readInfoEditionV3BatchState(cwd);
    state.running = false;
    recomputeV3BatchStats(state);
    writeInfoEditionV3BatchState(cwd, state);
    console.log(
      `[done] ok=${state.stats.ok} partial=${state.stats.partial} failed=${state.stats.failed} skipped=${state.stats.skipped}`,
    );
  } finally {
    releaseLock();
  }
}

run().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  try {
    const state = readInfoEditionV3BatchState(cwd);
    state.running = false;
    writeInfoEditionV3BatchState(cwd, state);
  } catch {
    /* ignore */
  }
  releaseLock();
  process.exit(1);
});
