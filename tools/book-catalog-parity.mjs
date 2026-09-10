#!/usr/bin/env node
/**
 * 圣经目录三端对拍：书卷号 / id / 中文名 / 章数。
 *
 * 这份数据是 66 条 × 4 字段的大块常量，两端各手持一份 —— 生成出来不等于正确，
 * 也不等于以后不会被改歪。以 RN 的 `lib/bible/scripture-books.ts` 为真源逐条比。
 *
 * 分组名与配色是 App 自己的设计（真源里没有），不参与对拍；
 * 但会检查两端分组划分一致、且并集恰好覆盖 66 卷不重不漏。
 *
 *   node tools/book-catalog-parity.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");

/* 真源 */
const tsSrc = read("lib/bible/scripture-books.ts");
const truth = [...tsSrc.matchAll(
  /\{\s*bookNumber:\s*(\d+),\s*bookId:\s*"(\w+)",\s*bookName:\s*"([^"]+)",\s*chapters:\s*(\d+)/g
)].map((m) => ({ number: +m[1], id: m[2], nameZh: m[3], chapters: +m[4] }));

/* iOS：BookRef(number: 1, id: "GEN", nameZh: "创世记", nameEn: "Genesis", chapterCount: 50) */
const swift = [...read("apps/askbible-ios/AskBible/Model/BibleCatalog.swift").matchAll(
  /BookRef\(number:\s*(\d+),\s*id:\s*"(\w+)",\s*nameZh:\s*"([^"]+)",\s*nameEn:\s*"([^"]+)",\s*chapterCount:\s*(\d+)\)/g
)].map((m) => ({ number: +m[1], id: m[2], nameZh: m[3], nameEn: m[4], chapters: +m[5] }));

/* Android：BookRef(1, "GEN", "创世记", "Genesis", 50) */
const kotlin = [...read("apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data/BibleCatalog.kt").matchAll(
  /BookRef\((\d+),\s*"(\w+)",\s*"([^"]+)",\s*"([^"]+)",\s*(\d+)\)/g
)].map((m) => ({ number: +m[1], id: m[2], nameZh: m[3], nameEn: m[4], chapters: +m[5] }));

const problems = [];
let checked = 0;

for (const [impl, rows] of [["iOS", swift], ["Android", kotlin]]) {
  // 卷数不对照样往下逐条比 —— 早前这里 continue，会让同一端后面的字段错误
  // 和另一端的错误全被这一条掩盖，看着像只有一个问题。
  if (rows.length !== truth.length) {
    problems.push(`${impl}: 卷数 ${rows.length}，真源 ${truth.length}`);
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const t of truth) {
    const r = byId.get(t.id);
    if (!r) { problems.push(`${impl}: 缺 ${t.id}（${t.nameZh}）`); continue; }
    for (const f of ["number", "nameZh", "chapters"]) {
      checked++;
      if (r[f] !== t[f]) {
        problems.push(`${impl} · ${t.id}.${f}: 真源 ${t[f]} / 实为 ${r[f]}`);
      }
    }
  }
}

// 两端英文名也要一致（真源没有英文名，但两端不能各写各的）。
// 不因两端卷数不等而跳过 —— 只比双方都有的那些 id，否则一个结构问题会掩盖所有命名问题。
{
  const kById = new Map(kotlin.map((r) => [r.id, r]));
  for (const s of swift) {
    const k = kById.get(s.id);
    if (!k) continue;
    checked++;
    if (s.nameEn !== k.nameEn) {
      problems.push(`英文名 · ${s.id}: iOS "${s.nameEn}" / Android "${k.nameEn}"`);
    }
  }
}

// 分组：两端划分必须一致，并集恰好覆盖全部书卷不重不漏
// 分组带 RN canon 的 sectionId（canon-torah …），id 与英文名两端都要一致
const groupsOf = (src, re) => [...src.matchAll(re)].map((m) => `${m[1]}=${m[2]}`);
const swGroups = groupsOf(read("apps/askbible-ios/AskBible/Model/BibleCatalog.swift"),
                          /BookGroup\(id:\s*"([^"]+)",\s*name:\s*"([^"]+)"/g);
const ktGroups = groupsOf(read("apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data/BibleCatalog.kt"),
                          /BookGroup\(\s*id\s*=\s*"([^"]+)",\s*name\s*=\s*"([^"]+)"/g);
checked++;
if (swGroups.length !== 10 || swGroups.join("|") !== ktGroups.join("|")) {
  problems.push(`分组划分不一致：\n      iOS    : ${swGroups.join(", ")}\n      Android: ${ktGroups.join(", ")}`);
}
// sectionId 必须是 RN canon-section-theme 里真实存在的 id（读经页分组标题按它查多语言表）
const canonIds = new Set([...read("lib/read/canon-section-theme.ts").matchAll(/"(canon-[a-z-]+)"\s*:/g)].map((m) => m[1]));
checked++;
const badIds = swGroups.map((g) => g.split("=")[0]).filter((id) => !canonIds.has(id));
if (badIds.length || canonIds.size !== 10) {
  problems.push(`分组 id 与 RN canon 不符：${badIds.join(", ") || "(RN 侧 id 数 " + canonIds.size + ")"}`);
}
for (const [impl, rows] of [["iOS", swift], ["Android", kotlin]]) {
  const ids = new Set(rows.map((r) => r.id));
  checked++;
  if (ids.size !== rows.length) problems.push(`${impl}: 分组里有重复书卷`);
}

if (problems.length) {
  console.error(`圣经目录对拍失败：${problems.length} 项\n`);
  for (const p of problems.slice(0, 12)) console.error("  " + p);
  if (problems.length > 12) console.error(`  …还有 ${problems.length - 12} 项`);
  process.exit(1);
}
console.log(`圣经目录对拍通过：${truth.length} 卷 × ${swGroups.length} 组，${checked} 项，TS 真源与 iOS / Android 一致。`);
