/**
 * 本机全本 / 分卷批量生成讲解版 + 发现版，逐章写入 data/bible/info-edition-v1-published.json。
 * 生成逻辑与后台「讲解版投送 / 发现版投送 → 确认生成」相同：
 *   planInfoEditionReaderGeneration → executeInfoEditionReaderPlan（DeepSeek + 角色 system）
 * 导读 user 含工作区描述规则；引导 user 仅经文。
 * 每卷完成后可选 scp 推到 Render 磁盘。支持断点续跑。
 *
 * 用法：
 *   npm run info-edition:batch
 *   INFO_EDITION_BATCH_FORCE=1 npm run info-edition:batch
 *   INFO_EDITION_BATCH_BOOK_START=GEN INFO_EDITION_BATCH_BOOK_END=GEN npm run info-edition:batch
 *   INFO_EDITION_BATCH_BOOK_START=MAT npm run info-edition:batch
 *   INFO_EDITION_BATCH_PUSH_EACH_BOOK=1 INFO_EDITION_REMOTE_SCP_TARGET='user@host:/var/data/info-edition-v1-published.json' npm run info-edition:batch
 *   npm run info-edition:batch:fix-invalid   # 仅重生成校验未通过的章
 *
 * 进度：npm run dev 后打开 http://localhost:3450/dev/info-edition-batch
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  generateInfoEditionChapterWithValidation,
  summarizeValidationIssues,
} from "@/lib/bible/info-edition-batch-chapter-run";
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
import { writeInvalidPublishedScanCache } from "@/lib/bible/info-edition-invalid-scan-cache";
import { scanInvalidPublishedChapters } from "@/lib/bible/info-edition-scan-invalid-published";
import { readerDescriptionRulesFromWorkspace } from "@/lib/bible/info-edition-v1-reader-generate-plan";
import { loadPublishedInfoEditionChapter } from "@/lib/bible/info-edition-v1-published-store";
import type { InfoEditionReaderVariant as Variant } from "@/lib/bible/info-edition-v1-publish";
import {
  resolveInfoEditionReaderTarget,
  type ResolvedInfoEditionReaderTarget,
} from "@/lib/bible/info-edition-v1-reader-persistence";
import { readGenerationRolesSync } from "@/lib/admin/generation-roles-store";
import { isInfoEditionBatchOnProductionDisk } from "@/lib/bible/info-edition-batch-access";
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

function batchOutputLanguage(): "zh-CN" | "en" {
  const raw = process.env.INFO_EDITION_BATCH_OUTPUT_LANGUAGE?.trim().toLowerCase();
  return raw === "en" ? "en" : "zh-CN";
}

function batchTranslationId(): string | null {
  const raw = process.env.INFO_EDITION_BATCH_TRANSLATION_ID?.trim();
  return raw ? raw : null;
}

function batchRoleIdOverride(edition: Variant): string | null {
  const raw =
    edition === "guide"
      ? process.env.INFO_EDITION_BATCH_GUIDE_ROLE_ID?.trim()
      : process.env.INFO_EDITION_BATCH_INFO_ROLE_ID?.trim();
  return raw ? raw : null;
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

function resolveBookIndex(raw: string, label: "START" | "END"): number | null {
  const id = raw.trim().toUpperCase();
  const byId = scriptureBooks.findIndex((b) => b.bookId === id);
  if (byId >= 0) return byId;
  const byNum = Number(id);
  if (Number.isInteger(byNum) && byNum >= 1 && byNum <= scriptureBooks.length) {
    return byNum - 1;
  }
  console.warn(`Unknown INFO_EDITION_BATCH_BOOK_${label}=${raw}`);
  return null;
}

function bookStartIndex(): number {
  const raw = process.env.INFO_EDITION_BATCH_BOOK_START?.trim();
  if (!raw) return 0;
  return resolveBookIndex(raw, "START") ?? 0;
}

function bookEndIndex(): number {
  const raw = process.env.INFO_EDITION_BATCH_BOOK_END?.trim();
  if (!raw) return scriptureBooks.length - 1;
  return resolveBookIndex(raw, "END") ?? scriptureBooks.length - 1;
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

function chapterPassesValidation(
  bookId: string,
  chapter: number,
  edition: Variant,
  roleId: string,
  outputLanguage: "zh-CN" | "en",
): boolean {
  const ch = loadPublishedInfoEditionChapter(cwd, bookId, chapter, {
    roleId,
    variant: edition,
  });
  if (!ch?.markdown?.trim()) return false;
  return validateInfoEditionOutput(ch.markdown, edition, { outputLanguage }).ok;
}

async function run(): Promise<void> {
  const editions = parseEditions();
  const fixInvalid = process.env.INFO_EDITION_BATCH_FIX_INVALID === "1";
  const force = fixInvalid || process.env.INFO_EDITION_BATCH_FORCE === "1";
  const skipExisting = fixInvalid
    ? true
    : force
      ? false
      : process.env.INFO_EDITION_BATCH_SKIP_EXISTING !== "0";
  const directDisk = isInfoEditionBatchOnProductionDisk(cwd);
  const pushEachBook =
    !directDisk && process.env.INFO_EDITION_BATCH_PUSH_EACH_BOOK === "1";
  const delayMs = Math.max(0, Number(process.env.INFO_EDITION_BATCH_DELAY_MS || 800));
  const stopOnError = process.env.INFO_EDITION_BATCH_STOP_ON_ERROR === "1";
  const strictOutput =
    process.env.INFO_EDITION_BATCH_STRICT_OUTPUT === "1" || fixInvalid;
  const outputLanguage = batchOutputLanguage();
  const translationId = batchTranslationId();

  readGenerationRolesSync(cwd);

  if (fixInvalid) {
    const invalid = scanInvalidPublishedChapters(cwd).filter((t) =>
      editions.includes(t.edition),
    );
    writeInvalidPublishedScanCache(cwd, invalid);
    console.log(
      `[fix-invalid] 扫描到 ${invalid.length} 个待修复任务（${editions.join(" + ")}）`,
    );
    if (invalid.length === 0) {
      console.log("[fix-invalid] 无待修复章节，退出。");
      return;
    }
  }
  const descriptionRulesForInfo =
    outputLanguage === "en" ? "" : readerDescriptionRulesFromWorkspace(cwd);
  const targetByEdition = new Map<Variant, ResolvedInfoEditionReaderTarget>();
  for (const ed of editions) {
    const t = resolveInfoEditionReaderTarget(cwd, {
      edition: ed,
      roleId: batchRoleIdOverride(ed),
    });
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

  const startBookIndex = fixInvalid
    ? bookStartIndex()
    : Math.max(state.cursor.bookIndex, bookStartIndex());
  const endBookIndex = Math.max(startBookIndex, bookEndIndex());

  const infoTarget = targetByEdition.get("info");
  const guideTarget = targetByEdition.get("guide");
  const endBook = scriptureBooks[endBookIndex];
  console.log(
    [
      `Batch: ${editions.join(" + ")}`,
      `pipeline: reader-generate (plan→execute)`,
      `lang=${outputLanguage}`,
      translationId ? `translation=${translationId}` : "translation=default",
      infoTarget ? `导读 role=${infoTarget.roleId}` : null,
      guideTarget ? `引导 role=${guideTarget.roleId}` : null,
      editions.includes("info")
        ? `导读描述规则 ${descriptionRulesForInfo.length} 字`
        : null,
      `books ${scriptureBooks[startBookIndex]?.bookId ?? "?"}…${endBook?.bookId ?? "?"}`,
      fixInvalid
        ? "fix invalid only"
        : skipExisting
          ? "skip existing"
          : "regenerate all",
      directDisk ? "direct disk" : pushEachBook ? "push each book" : "local only",
    ]
      .filter(Boolean)
      .join(" | "),
  );

  try {
    for (let bi = startBookIndex; bi <= endBookIndex && bi < scriptureBooks.length; bi++) {
      const book = scriptureBooks[bi];
      const bookState = ensureBookState(state, book.bookId, book.bookName, book.chapters);

      let startChapter =
        !fixInvalid && bi === state.cursor.bookIndex ? state.cursor.chapter : 1;
      let startEditionIndex =
        !fixInvalid && bi === state.cursor.bookIndex ? state.cursor.editionIndex : 0;

      for (let ci = startChapter; ci <= book.chapters; ci++) {
        for (let ei = ci === startChapter ? startEditionIndex : 0; ei < editions.length; ei++) {
          const edition = editions[ei];
          const target = targetByEdition.get(edition)!;

          state.cursor = { bookIndex: bi, chapter: ci, editionIndex: ei };
          writeInfoEditionBatchState(cwd, state);

          const label = `${book.bookName} ${ci}章 · ${edition === "guide" ? "发现版" : "讲解版"}`;

          const skipBecauseValid =
            fixInvalid &&
            chapterPassesValidation(book.bookId, ci, edition, target.roleId, outputLanguage);
          const skipBecauseExists =
            !fixInvalid &&
            skipExisting &&
            chapterAlreadyOk(book.bookId, ci, edition, target.roleId);

          if (skipBecauseValid || skipBecauseExists) {
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
          const result = await generateInfoEditionChapterWithValidation(
            cwd,
            book.bookId,
            ci,
            target,
            {
              descriptionRulesOverride:
                edition === "info" ? descriptionRulesForInfo : undefined,
              translationIdOverride: translationId,
              outputLanguage,
            },
          );

          if (result.ok && result.published && result.check) {
            const check = result.check;
            if (check.warnCount > 0) {
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
            const retryNote =
              result.attempts > 1 ? `, ${result.attempts}次尝试` : "";
            console.log(
              `[ok] ${label} (${Math.round((Date.now() - t0) / 1000)}s, ${check.charCount}字${check.warnCount ? `, ${check.warnCount}提醒` : ""}${retryNote})`,
            );
          } else {
            const summary =
              result.check && !result.check.ok
                ? summarizeValidationIssues(result.check, edition)
                : result.checkSummary ?? result.error ?? "生成或校验失败";
            console.error(
              `[check-fail] ${label}: ${summary}${result.attempts > 1 ? ` (${result.attempts}次尝试)` : ""}`,
            );
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
            if (stopOnError || strictOutput) {
              if (stopOnError) throw new Error(summary);
            }
          }

          writeInfoEditionBatchState(cwd, state);
          if (delayMs > 0) await sleep(delayMs);
        }
      }

      const bookComplete = isBookGenerationComplete(bookState, book.chapters, editions);
      if (bookComplete && (pushEachBook || directDisk)) {
        if (directDisk) {
          bookState.syncedAt = new Date().toISOString();
          delete bookState.lastSyncError;
          console.log(`[disk] ${book.bookName} complete (published on DATA_ROOT)`);
        } else {
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
