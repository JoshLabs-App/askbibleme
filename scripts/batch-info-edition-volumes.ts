/**
 * 本机全本 / 分卷批量生成导读版 + 引导版，逐章写入 data/bible/info-edition-v1-published.json。
 * 生成逻辑与后台「导读版投送 / 引导版投送 → 确认生成」相同：
 *   planInfoEditionReaderGeneration → executeInfoEditionReaderPlan（DeepSeek + 角色 system）
 * 导读 user 含工作区描述规则；引导 user 仅经文。
 * 每卷完成后可选 scp 推到 Render 磁盘。支持断点续跑。
 *
 * 用法：
 *   npm run info-edition:batch
 *   INFO_EDITION_BATCH_FORCE=1 npm run info-edition:batch
 *   INFO_EDITION_BATCH_BOOK_START=MAT npm run info-edition:batch
 *   INFO_EDITION_BATCH_PUSH_EACH_BOOK=1 INFO_EDITION_REMOTE_SCP_TARGET='user@host:/var/data/info-edition-v1-published.json' npm run info-edition:batch
 *
 * 进度：npm run dev 后打开 http://localhost:3450/dev/info-edition-batch
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { generateInfoEditionChapterForReader } from "@/lib/bible/info-edition-v1-generate-reader";
import {
  countBatchProgress,
  ensureBookState,
  infoEditionBatchLockPath,
  readInfoEditionBatchState,
  setChapterStatus,
  writeInfoEditionBatchState,
  type InfoEditionBatchState,
} from "@/lib/bible/info-edition-v1-batch-state";
import { validateInfoEditionOutput } from "@/lib/bible/info-edition-v1-output-validate";
import { readerDescriptionRulesFromWorkspace } from "@/lib/bible/info-edition-v1-reader-generate-plan";
import { loadPublishedInfoEditionChapter } from "@/lib/bible/info-edition-v1-published-store";
import type { InfoEditionReaderVariant as Variant } from "@/lib/bible/info-edition-v1-publish";
import {
  resolveInfoEditionReaderTarget,
  type ResolvedInfoEditionReaderTarget,
} from "@/lib/bible/info-edition-v1-reader-persistence";
import { readGenerationRolesSync } from "@/lib/admin/generation-roles-store";
import { scriptureBooks } from "@/lib/bible/scripture-books";

const cwd = process.cwd();

function parseEditions(): Variant[] {
  const raw = process.env.INFO_EDITION_BATCH_EDITIONS?.trim() || "info,guide";
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is Variant => s === "info" || s === "guide");
  return list.length ? list : ["info", "guide"];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function acquireLock(): void {
  const lock = infoEditionBatchLockPath(cwd);
  if (fs.existsSync(lock)) {
    const pid = fs.readFileSync(lock, "utf8").trim();
    try {
      process.kill(Number(pid), 0);
      console.error(`Another batch is running (PID ${pid}). Lock: ${lock}`);
      process.exit(1);
    } catch {
      /* stale */
    }
  }
  fs.writeFileSync(lock, String(process.pid), "utf8");
}

function releaseLock(): void {
  const lock = infoEditionBatchLockPath(cwd);
  try {
    if (fs.existsSync(lock)) fs.unlinkSync(lock);
  } catch {
    /* ignore */
  }
}

function pushPublishedToRemote(): { ok: boolean; error?: string } {
  const target = process.env.INFO_EDITION_REMOTE_SCP_TARGET?.trim();
  if (!target) {
    return { ok: false, error: "未设置 INFO_EDITION_REMOTE_SCP_TARGET" };
  }
  const script = path.join(cwd, "scripts", "push-info-edition-published-remote.mjs");
  const r = spawnSync(process.execPath, [script], {
    stdio: "inherit",
    env: { ...process.env, INFO_EDITION_REMOTE_SCP_TARGET: target },
  });
  if (r.status !== 0) {
    return { ok: false, error: `scp 退出码 ${r.status ?? 1}` };
  }
  return { ok: true };
}

function bookStartIndex(): number {
  const raw = process.env.INFO_EDITION_BATCH_BOOK_START?.trim().toUpperCase();
  if (!raw) return 0;
  const byId = scriptureBooks.findIndex((b) => b.bookId === raw);
  if (byId >= 0) return byId;
  const byNum = Number(raw);
  if (Number.isInteger(byNum) && byNum >= 1 && byNum <= scriptureBooks.length) {
    return byNum - 1;
  }
  console.warn(`Unknown INFO_EDITION_BATCH_BOOK_START=${raw}, starting from GEN`);
  return 0;
}

function chapterAlreadyOk(
  bookId: string,
  chapter: number,
  edition: Variant,
  roleId: string,
): boolean {
  const ch = loadPublishedInfoEditionChapter(cwd, bookId, chapter, {
    roleId,
    variant: edition,
  });
  return Boolean(ch?.markdown?.trim());
}

async function run(): Promise<void> {
  const editions = parseEditions();
  const force = process.env.INFO_EDITION_BATCH_FORCE === "1";
  const skipExisting = force ? false : process.env.INFO_EDITION_BATCH_SKIP_EXISTING !== "0";
  const pushEachBook = process.env.INFO_EDITION_BATCH_PUSH_EACH_BOOK === "1";
  const delayMs = Math.max(0, Number(process.env.INFO_EDITION_BATCH_DELAY_MS || 800));
  const stopOnError = process.env.INFO_EDITION_BATCH_STOP_ON_ERROR === "1";
  const strictOutput = process.env.INFO_EDITION_BATCH_STRICT_OUTPUT === "1";

  readGenerationRolesSync(cwd);
  const descriptionRulesForInfo = readerDescriptionRulesFromWorkspace(cwd);
  const targetByEdition = new Map<Variant, ResolvedInfoEditionReaderTarget>();
  for (const ed of editions) {
    const t = resolveInfoEditionReaderTarget(cwd, { edition: ed });
    if ("error" in t) {
      console.error(t.error);
      process.exit(1);
    }
    targetByEdition.set(ed, t);
  }

  acquireLock();
  const totalChapters = scriptureBooks.reduce((s, b) => s + b.chapters, 0);

  let state = readInfoEditionBatchState(cwd, editions);
  state.running = true;
  state.skipExisting = skipExisting;
  state.force = force;
  state.editions = editions;
  writeInfoEditionBatchState(cwd, state);

  const startBookIndex = Math.max(state.cursor.bookIndex, bookStartIndex());

  const infoTarget = targetByEdition.get("info");
  const guideTarget = targetByEdition.get("guide");
  console.log(
    [
      `Batch: ${editions.join(" + ")}`,
      `pipeline: reader-generate (plan→execute)`,
      infoTarget ? `导读 role=${infoTarget.roleId}` : null,
      guideTarget ? `引导 role=${guideTarget.roleId}` : null,
      editions.includes("info")
        ? `导读描述规则 ${descriptionRulesForInfo.length} 字`
        : null,
      `books ${startBookIndex + 1}/${scriptureBooks.length}…${scriptureBooks.length}`,
      skipExisting ? "skip existing" : "regenerate all",
      pushEachBook ? "push each book" : "local only",
    ]
      .filter(Boolean)
      .join(" | "),
  );

  try {
    for (let bi = startBookIndex; bi < scriptureBooks.length; bi++) {
      const book = scriptureBooks[bi];
      const bookState = ensureBookState(state, book.bookId, book.bookName, book.chapters);

      let startChapter = bi === state.cursor.bookIndex ? state.cursor.chapter : 1;
      let startEditionIndex = bi === state.cursor.bookIndex ? state.cursor.editionIndex : 0;

      for (let ci = startChapter; ci <= book.chapters; ci++) {
        for (let ei = ci === startChapter ? startEditionIndex : 0; ei < editions.length; ei++) {
          const edition = editions[ei];
          const target = targetByEdition.get(edition)!;

          state.cursor = { bookIndex: bi, chapter: ci, editionIndex: ei };
          writeInfoEditionBatchState(cwd, state);

          const label = `${book.bookName} ${ci}章 · ${edition === "guide" ? "引导版" : "导读版"}`;

          if (skipExisting && chapterAlreadyOk(book.bookId, ci, edition, target.roleId)) {
            setChapterStatus(bookState, ci, edition, "skipped");
            state.stats.skipped += 1;
            state.lastRun = {
              bookId: book.bookId,
              chapter: ci,
              edition,
              at: new Date().toISOString(),
            };
            writeInfoEditionBatchState(cwd, state);
            console.log(`[skip] ${label}`);
            continue;
          }

          console.log(`[gen] ${label} …`);
          const t0 = Date.now();
          const result = await generateInfoEditionChapterForReader(
            cwd,
            book.bookId,
            ci,
            target,
            edition === "info"
              ? { descriptionRulesOverride: descriptionRulesForInfo }
              : undefined,
          );

          if (result.ok) {
            const md = result.published.markdown;
            const check = validateInfoEditionOutput(md, edition);
            if (!check.ok) {
              const summary = check.checks.map((c) => c.message).join("; ");
              console.error(`[check-fail] ${label}: ${summary}`);
              if (strictOutput) {
                setChapterStatus(bookState, ci, edition, "failed");
                state.stats.failed += 1;
                state.lastRun = {
                  bookId: book.bookId,
                  chapter: ci,
                  edition,
                  at: new Date().toISOString(),
                  error: summary,
                };
                writeInfoEditionBatchState(cwd, state);
                if (stopOnError) throw new Error(summary);
                if (delayMs > 0) await sleep(delayMs);
                continue;
              }
            } else if (check.warnCount > 0) {
              console.warn(
                `[check-warn] ${label}: ${check.checks
                  .filter((c) => c.level === "warn")
                  .map((c) => c.message)
                  .join("; ")}`,
              );
            }
            setChapterStatus(bookState, ci, edition, "ok");
            state.stats.ok += 1;
            state.lastRun = {
              bookId: book.bookId,
              chapter: ci,
              edition,
              at: new Date().toISOString(),
            };
            console.log(
              `[ok] ${label} (${Math.round((Date.now() - t0) / 1000)}s, ${check.charCount}字${check.warnCount ? `, ${check.warnCount}提醒` : ""})`,
            );
          } else {
            setChapterStatus(bookState, ci, edition, "failed");
            state.stats.failed += 1;
            state.lastRun = {
              bookId: book.bookId,
              chapter: ci,
              edition,
              at: new Date().toISOString(),
              error: result.error,
            };
            console.error(`[fail] ${label}: ${result.error}`);
            writeInfoEditionBatchState(cwd, state);
            if (stopOnError) {
              throw new Error(result.error);
            }
          }

          writeInfoEditionBatchState(cwd, state);
          if (delayMs > 0) await sleep(delayMs);
        }
      }

      const bookComplete = isBookGenerationComplete(bookState, book.chapters, editions);
      if (bookComplete && pushEachBook) {
        console.log(`[sync] ${book.bookName} → remote …`);
        const push = pushPublishedToRemote();
        if (push.ok) {
          bookState.syncedAt = new Date().toISOString();
          delete bookState.lastSyncError;
          console.log(`[sync] ${book.bookName} OK`);
        } else {
          bookState.lastSyncError = push.error;
          console.error(`[sync] ${book.bookName} failed: ${push.error}`);
        }
        writeInfoEditionBatchState(cwd, state);
      }

      state.cursor = { bookIndex: bi + 1, chapter: 1, editionIndex: 0 };
      writeInfoEditionBatchState(cwd, state);
    }

    state = readInfoEditionBatchState(cwd, editions);
    state.running = false;
    writeInfoEditionBatchState(cwd, state);

    const progress = countBatchProgress(state, totalChapters);
    console.log(
      `\nDone. ok=${state.stats.ok} skipped=${state.stats.skipped} failed=${state.stats.failed} (${progress.percent}%)`,
    );
    if (process.env.INFO_EDITION_BATCH_PUSH_EACH_BOOK !== "1") {
      console.log(
        "Tip: push all to Render: INFO_EDITION_REMOTE_SCP_TARGET='…' npm run info-edition:push-remote",
      );
    }
  } finally {
    state = readInfoEditionBatchState(cwd, editions);
    state.running = false;
    writeInfoEditionBatchState(cwd, state);
    releaseLock();
  }
}

function isBookGenerationComplete(
  book: InfoEditionBatchState["books"][string],
  chapters: number,
  editions: Variant[],
): boolean {
  for (let c = 1; c <= chapters; c++) {
    const row = book.byChapter[String(c)];
    for (const ed of editions) {
      const st = row?.[ed];
      if (st !== "ok" && st !== "skipped") return false;
    }
  }
  return true;
}

run().catch((err) => {
  console.error(err);
  releaseLock();
  process.exit(1);
});
