#!/usr/bin/env node
/**
 * 读经计划可用性：12 个计划的每一天、每一段，逐章对着四个内置译本库核对——
 * 书卷 id 在目录里、章号在范围内、该译本库里真有这一章的经文。
 * 三循环 / 新约深读不是日课表，是按书卷顺序走指针，等价于「全本每一章」/「新约每一章 + 旧约每一章」。
 * UST（56 卷）缺的书卷会列出来，供章页回退用；简体 / 繁体 / WEBP 缺任何一章都算失败。
 *
 *   node tools/reading-plan-usability-check.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RES = path.join(ROOT, "apps/askbible-ios/AskBible/Resources");
const AND = path.join(ROOT, "apps/askbible-android/app/src/main/assets");
const TRANSLATIONS = ["cuv-simp", "cuv-trad", "web-en", "ust-en"];
const MUST_COVER = new Set(["cuv-simp", "cuv-trad", "web-en"]);

// 每个译本库：book_id:chapter → 节数（两端的 sqlite 必须是同一份）
const coverage = {};
for (const t of TRANSLATIONS) {
  const ios = readFileSync(path.join(RES, `${t}.sqlite`));
  const and = readFileSync(path.join(AND, `${t}.sqlite`));
  if (!ios.equals(and)) throw new Error(`${t}.sqlite 两端不是同一份`);
  const rows = JSON.parse(execFileSync("sqlite3", ["-json", path.join(RES, `${t}.sqlite`), "select book_id as b, chapter as c, count(*) as n from verse group by 1,2"], { encoding: "utf8" }) || "[]");
  coverage[t] = new Map(rows.map((r) => [`${r.b}:${r.c}`, r.n]));
}
// 参考章数：简体全本 66 卷 1189 章
const chapterCount = {};
for (const key of coverage["cuv-simp"].keys()) { const [b, c] = key.split(":"); chapterCount[b] = Math.max(chapterCount[b] || 0, Number(c)); }
const bookOrder = JSON.parse(readFileSync(path.join(ROOT, "apps/askbible-android/app/src/main/assets/chapter-segments.json"), "utf8")) ? null : null;

// 计划：注册表里的日课表 + 两个主推
const registry = JSON.parse(readFileSync(path.join(ROOT, "data/bible-reading-plans/registry.json"), "utf8"));
const plans = [];
for (const p of registry.plans) {
  if (p.listHidden) continue;
  const bundle = JSON.parse(readFileSync(path.join(ROOT, p.bundlePath), "utf8"));
  plans.push({ planId: p.planId, name: p.name, days: bundle.days });
}
const allBooks = Object.keys(chapterCount);
const otBooks = allBooks.slice(0, 39), ntBooks = allBooks.slice(39);
const everyChapter = (books) => [{ dayIndex: 0, readings: books.map((b) => ({ bookId: b, startChapter: 1, endChapter: chapterCount[b] })) }];
plans.unshift({ planId: "nt-deep-repeat", name: "新约深读 · 旧约通读", days: everyChapter([...ntBooks, ...otBooks]) });
plans.unshift({ planId: "triple-loop", name: "轻松循环读经计划", days: everyChapter(allBooks) });

const problems = [];
const lines = [];
const ustMissingBooks = new Set();
for (const plan of plans) {
  let readings = 0, chapters = 0;
  const missing = Object.fromEntries(TRANSLATIONS.map((t) => [t, 0]));
  const missingBooks = Object.fromEntries(TRANSLATIONS.map((t) => [t, new Set()]));
  for (const day of plan.days) {
    for (const r of day.readings) {
      readings += 1;
      const count = chapterCount[r.bookId];
      if (!count) { problems.push(`${plan.planId} 第 ${day.dayIndex + 1} 天：书卷 ${r.bookId} 不在目录里`); continue; }
      if (!(r.startChapter >= 1 && r.endChapter >= r.startChapter && r.endChapter <= count)) {
        problems.push(`${plan.planId} 第 ${day.dayIndex + 1} 天：${r.bookId} ${r.startChapter}–${r.endChapter} 超出 ${count} 章`); continue;
      }
      for (let c = r.startChapter; c <= r.endChapter; c += 1) {
        chapters += 1;
        for (const t of TRANSLATIONS) {
          if (!coverage[t].get(`${r.bookId}:${c}`)) { missing[t] += 1; missingBooks[t].add(r.bookId); if (t === "ust-en") ustMissingBooks.add(r.bookId); }
        }
      }
    }
  }
  for (const t of MUST_COVER) if (missing[t] > 0) problems.push(`${plan.planId} 在 ${t} 缺 ${missing[t]} 章：${[...missingBooks[t]].join(",")}`);
  lines.push(`${plan.planId.padEnd(32)} ${String(plan.days.length).padStart(3)} 天 ${String(readings).padStart(5)} 段 ${String(chapters).padStart(5)} 章 · UST 缺 ${String(missing["ust-en"]).padStart(4)} 章${missingBooks["ust-en"].size ? `（${[...missingBooks["ust-en"]].join(" ")}）` : ""}`);
}

if (problems.length) {
  console.error("读经计划可用性检查失败：\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`读经计划可用性通过：${plans.length} 个计划，简体 / 繁体 / WEBP 每一章都在库里；两端 sqlite 同一份`);
console.log(lines.join("\n"));
console.log(`UST 缺的书卷（${ustMissingBooks.size}）：${[...ustMissingBooks].join(" ")} —— 这些章在 UST 下要靠章页回退`);
