/**
 * V3 纠错：DeepSeek 找错诊断 → 修订讲解/发现 → 写入 info-edition-v1-published.json
 *
 * 用法：
 *   npm run info-edition:v3-apply -- GEN 33
 *   npm run info-edition:v3-apply -- GEN 33 34 35 36
 *   npm run info-edition:v3-apply -- --dry-run GEN 36
 *   INFO_EDITION_V3_BOOK=GEN INFO_EDITION_V3_CHAPTER_START=33 INFO_EDITION_V3_CHAPTER_END=36 npm run info-edition:v3-apply
 */
import path from "node:path";
import { readGenerationRolesSync } from "@/lib/admin/generation-roles-store";
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

function parseTasks(): { bookId: string; chapter: number }[] {
  const dryRun = process.argv.includes("--dry-run");
  const args = process.argv.slice(2).filter((a) => a !== "--dry-run");
  const envBook = process.env.INFO_EDITION_V3_BOOK?.trim().toUpperCase();
  const start = Number(process.env.INFO_EDITION_V3_CHAPTER_START);
  const end = Number(process.env.INFO_EDITION_V3_CHAPTER_END);

  if (envBook && Number.isInteger(start) && start >= 1) {
    const book = scriptureBooks.find((b) => b.bookId === envBook);
    if (!book) throw new Error(`无效书卷 ${envBook}`);
    const last = Number.isInteger(end) && end >= start ? Math.min(end, book.chapters) : start;
    return Array.from({ length: last - start + 1 }, (_, i) => ({ bookId: envBook, chapter: start + i }));
  }

  if (args.length >= 2) {
    const bookId = args[0].trim().toUpperCase();
    const book = scriptureBooks.find((b) => b.bookId === bookId);
    if (!book) throw new Error(`无效书卷 ${bookId}`);
    return args
      .slice(1)
      .map((c) => Number(c))
      .filter((c) => Number.isInteger(c) && c >= 1 && c <= book.chapters)
      .map((chapter) => ({ bookId, chapter }));
  }

  throw new Error(
    "用法: npm run info-edition:v3-apply -- GEN 33 [34 …] 或 INFO_EDITION_V3_BOOK=GEN INFO_EDITION_V3_CHAPTER_START=33 INFO_EDITION_V3_CHAPTER_END=36",
  );
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const tasks = parseTasks();
  const delayMs = Math.max(0, Number(process.env.INFO_EDITION_V3_DELAY_MS || 1200));

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

  console.log(
    `[v3-apply] DeepSeek ${deepseek.settings.model} · ${tasks.length} 章${dryRun ? "（dry-run，不写盘）" : ""}`,
  );

  let okCount = 0;
  let failCount = 0;

  for (const { bookId, chapter } of tasks) {
    const book = scriptureBooks.find((b) => b.bookId === bookId);
    const label = `${book?.bookName ?? bookId} ${chapter}章`;
    const loaded = await loadInfoEditionV3ChapterSource(cwd, bookId, chapter);
    if (!loaded.ok) {
      console.error(`[skip] ${label}: ${loaded.error}`);
      failCount += 1;
      continue;
    }

    console.log(`[run] ${label} …`);
    const result = await runInfoEditionV3CorrectionPipeline(
      cwd,
      loaded.source,
      roles,
      deepseek.profile,
      deepseek.settings,
      { publish: !dryRun },
    );

    if (result.errors.length) {
      console.error(`[fail] ${label}:`);
      for (const e of result.errors) console.error(`  - ${e}`);
      failCount += 1;
    } else {
      const parts: string[] = [];
      if (result.publishedInfo) parts.push(`讲解 ${result.publishedInfo.charCount}字`);
      if (result.publishedGuide) parts.push(`发现 ${result.publishedGuide.charCount}字`);
      if (dryRun) {
        if (result.reviseInfo?.text) parts.push(`讲解稿 ${result.reviseInfo.charCount}字（未写盘）`);
        if (result.reviseGuide?.text) parts.push(`发现稿 ${result.reviseGuide.charCount}字（未写盘）`);
      }
      console.log(`[ok] ${label} · 诊断 ${result.critique.charCount}字${parts.length ? ` · ${parts.join(" · ")}` : ""}`);
      okCount += 1;
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  console.log(`[done] 成功 ${okCount} · 失败 ${failCount}`);
  if (failCount > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
