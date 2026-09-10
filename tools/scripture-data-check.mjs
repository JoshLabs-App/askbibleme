#!/usr/bin/env node
/**
 * 原生数据层自检：四个内置译本 + xref 库能否打开、内容是否确实不同、章数是否正确。
 *
 * 直接 swiftc 编译 App 里那份 ScriptureDatabase.swift / VerseAnnotations.swift ——
 * 这也是把 ScriptureStore（ObservableObject）拆成独立文件的原因：
 * 数据层保持纯 Foundation，才能脱离 App 单独跑。
 *
 *   node tools/scripture-data-check.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IOS = path.join(ROOT, "apps/askbible-ios/AskBible");
const RES = path.join(IOS, "Resources");

const bin = path.join(mkdtempSync(path.join(tmpdir(), "datacheck-")), "datacheck");
execFileSync("swiftc", ["-O", "-swift-version", "5",
  path.join(IOS, "Model/ScriptureDatabase.swift"),
  path.join(IOS, "Model/VerseAnnotations.swift"),
  path.join(ROOT, "tools/swift-harness/datacheck/main.swift"),
  "-o", bin], { stdio: "pipe" });

const report = JSON.parse(execFileSync(bin, [RES], { encoding: "utf8" }));

const problems = [...report.errors];
const EXPECTED_IDS = ["cuv-simp", "cuv-trad", "web-en", "ust-en"];

if (report.translations.length !== EXPECTED_IDS.length) {
  problems.push(`只打开了 ${report.translations.length} / ${EXPECTED_IDS.length} 个译本`);
}
for (const t of report.translations) {
  if (t.gen1VerseCount !== 31) problems.push(`${t.id}: 创世记 1 章应为 31 节，实为 ${t.gen1VerseCount}`);
  if (t.genChapterCount !== 50) problems.push(`${t.id}: 创世记应为 50 章，实为 ${t.genChapterCount}`);
  if (t.markChapterCount !== 16) problems.push(`${t.id}: 马可福音应为 16 章，实为 ${t.markChapterCount}`);
  if (!t.gen1_1?.trim()) problems.push(`${t.id}: 创世记 1:1 读出来是空的`);
}
// 四个译本文本必须互不相同 —— 相同说明装错了库或全都回退到了同一个
const texts = new Set(report.translations.map((t) => t.gen1_1));
if (texts.size !== report.translations.length) {
  problems.push(`译本文本有重复：${report.translations.length} 个库只有 ${texts.size} 种文本`);
}
if (report.xrefGen1.length === 0) problems.push("xref 库查不出创世记 1 章的任何交叉引用");

if (problems.length) {
  console.error(`原生数据层自检失败：${problems.length} 项\n`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}

console.log(`原生数据层自检通过：${report.translations.length} 个内置译本 + xref 库。`);
for (const t of report.translations) {
  const head = t.gen1_1.length > 34 ? t.gen1_1.slice(0, 34) + "…" : t.gen1_1;
  console.log(`  ${t.id.padEnd(9)} 创1:1「${head}」 ${t.genChapterCount}章/${t.gen1VerseCount}节`);
}
console.log(`  创世记 1 章带交叉引用的节：${report.xrefGen1.join(", ")}`);
