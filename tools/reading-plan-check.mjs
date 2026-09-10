#!/usr/bin/env node
/**
 * 读经计划三方对拍（TS 共享库 ↔ Swift ↔ Kotlin）。
 * 会漂的都是手写逻辑：复活节历元与日期差、三种起始方式的日课下标、三循环指针的推进 / 对齐 / 裁回、
 * 新约深读 52 阶的切分与按天推进、从进度反推第几天、文案格式。任何一处漂了，两端「今日读经」就不是同一章。
 *   node tools/reading-plan-check.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IOS = path.join(ROOT, "apps/askbible-ios/AskBible");
const ANDROID_ROOT = path.join(ROOT, "apps/askbible-android");
const KOTLIN_BIN = path.join(ANDROID_ROOT, "core/build/install/core/bin/core");

execFileSync(process.execPath, [path.join(ROOT, "tools/gen-reading-plans.mjs")], { stdio: "pipe" });

const CASES = [
  ["epoch", "2026-04-05"], ["epoch", "2026-04-04"], ["epoch", "2026-09-09"], ["epoch", "2026-12-31"], ["epoch", "2027-03-01"],
  ["dayindex", "from-today", "2026-09-01", "365", "2026-09-09"], ["dayindex", "calendar-jan1", "", "365", "2026-09-09"],
  ["dayindex", "calendar-easter", "", "365", "2026-09-09"], ["dayindex", "from-today", "2026-12-01", "365", "2026-09-09"],
  ["dayindex", "from-today", "2025-01-01", "100", "2026-09-09"], ["dayindex", "calendar-jan1", "", "365", "2027-12-31"],
  ["dayindex", "calendar-jan1", "", "365", "2028-12-31"],
  ["ntday", "2026-09-01", "2026-09-09"], ["ntday", "", "2026-09-09"], ["ntday", "2026-02-31", "2026-03-05"], ["ntday", "2026-10-01", "2026-09-09"],
  ["triple", "1"], ["triple", "2"], ["triple", "50"], ["triple", "157"], ["triple", "400"], ["triple", "1200"], ["triple", "3000"],
  ["triplefix", "157", "GEN:1", "MAT:1", "JOB:1"], ["triplefix", "157", "LEV:5", "JHN:3", "PSA:100"], ["triplefix", "2", "NUM:1", "ACT:1", "PRO:1"], ["triplefix", "10", "EXO:9", "MAT:10", "JOB:10"],
  ["tripleadv", "ot", "GEN:50", "MAT:1", "JOB:1"], ["tripleadv", "wisdom", "GEN:1", "MAT:1", "SNG:8"], ["tripleadv", "nt", "GEN:1", "REV:22", "JOB:1"], ["tripleadv", "ot", "EST:10", "MAT:1", "JOB:1"],
  ["tripleread", "GEN", "3", "GEN:1,GEN:2;MAT:1;"], ["tripleread", "GEN", "2", "GEN:1,GEN:2,GEN:2;;PSA:1"], ["tripleread", "PSA", "23", ";;"], ["tripleread", "XXX", "1", "GEN:1;;"],
  ["ntseg", "0"], ["ntseg", "1"], ["ntseg", "5"], ["ntseg", "12"], ["ntseg", "51"], ["ntseg", "52"], ["ntseg", "-1"],
  ["ntstate", "1", "7", "2026-09-01"], ["ntstate", "8", "7", "2026-09-01"], ["ntstate", "9", "14", "2026-09-01"], ["ntstate", "365", "7", "2026-01-01"], ["ntstate", "400", "28", "2026-01-01"], ["ntstate", "1500", "7", "2026-04-05"],
  ["ntinfer", "0", "1", "7", "2026-09-01"], ["ntinfer", "1", "1", "7", "2026-09-01"], ["ntinfer", "3", "5", "14", "2026-09-01"], ["ntinfer", "51", "28", "28", "2026-01-01"],
  ["ntadvnt", "0", "7", "7", "7"], ["ntadvnt", "0", "3", "7", "7"], ["ntadvnt", "51", "14", "14", "14"],
  ["fmt", "GEN", "1", "1"], ["fmt", "PSA", "23", "23"], ["fmt", "JHN", "1", "5"], ["fmt", "1CO", "13", "13"],
  ["ntfmt", "GEN", "1", "1"], ["ntfmt", "PSA", "119", "119"], ["ntfmt", "JHN", "1", "5"],
  ["dur", "30"], ["dur", "60"], ["dur", "364"], ["dur", "728"], ["dur", "1456"],
  ["catalog"], ["curriculum"], ["orders"],
  // 播放页（PlanPlay）：进度偏移 / 日历可点 / 第 N 天 / 日课表下标 / 月历格
  ["ahead", "0", "0"], ["ahead", "-3", "0"], ["ahead", "2", "5"], ["ahead", "-2", "5"], ["ahead", "0", "-4"],
  ["aheadsel", "triple-loop", "calendar-easter", "2026-04-05", "1", "-400", "2026-09-09"], ["aheadsel", "nt-deep-repeat", "from-today", "2026-09-01", "", "30", "2026-09-09"],
  ["aheadsel", "x", "from-today", "2026-09-01", "365", "-8", "2026-09-09"], ["aheadsel", "x", "from-today", "2026-09-01", "365", "-9", "2026-09-09"],
  ["aheadsel", "x", "from-today", "2026-09-01", "365", "356", "2026-09-09"], ["aheadsel", "x", "from-today", "2026-09-01", "365", "357", "2026-09-09"],
  ["aheadsel", "x", "calendar-jan1", "", "365", "-260", "2026-09-09"], ["aheadsel", "x", "from-today", "2026-09-01", "0", "0", "2026-09-09"],
  ["planday", "triple-loop", "calendar-easter", "2026-04-05", "1", "0", "2026-09-09"], ["planday", "triple-loop", "calendar-easter", "2026-04-05", "1", "-300", "2026-09-09"],
  ["planday", "nt-deep-repeat", "from-today", "2026-09-01", "", "3", "2026-09-09"], ["planday", "nt-deep-repeat", "from-today", "", "", "0", "2026-09-09"],
  ["planday", "x", "from-today", "2026-09-01", "365", "2", "2026-09-09"], ["planday", "x", "calendar-jan1", "", "365", "0", "2026-09-09"],
  ["regidx", "from-today", "2026-09-01", "365", "0", "2026-09-09"], ["regidx", "from-today", "2026-09-01", "365", "-20", "2026-09-09"],
  ["regidx", "from-today", "2026-09-01", "365", "400", "2026-09-09"], ["regidx", "calendar-jan1", "", "365", "5", "2026-09-09"],
  ["calgrid", "2026", "9", "2026-09-09", "0", "2026-09-01,2026-09-08,2026-08-31", "all"], ["calgrid", "2026", "9", "2026-09-09", "3", "", "range:-2:2"],
  ["calgrid", "2026", "2", "2026-09-09", "0", "2026-02-14", "all"], ["calgrid", "2024", "2", "2024-02-29", "-1", "", "all"],
  ["calgrid", "2026", "10", "2026-09-30", "1", "2026-10-01", "range:0:0"], ["calgrid", "2027", "1", "2026-12-31", "1", "", "all"],
];
const stdin = CASES.map((c) => c.join("\t")).join("\n") + "\n";
function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { input: stdin, encoding: "utf8", cwd: ROOT });
  if (r.status !== 0) throw new Error(`${label} 跑失败：${(r.stderr || r.stdout).split("\n").slice(0, 5).join(" | ")}`);
  if (r.stderr?.trim()) console.error(r.stderr.trim());
  return JSON.parse(r.stdout);
}
const bin = path.join(mkdtempSync(path.join(tmpdir(), "plans-")), "bin");
execFileSync("swiftc", ["-O", "-swift-version", "5",
  // BibleCatalog 用到 Color(rgb:)，得带上主题文件；macOS SDK 自带 SwiftUI，能编
  path.join(IOS, "Theme/ParchmentTheme.swift"), path.join(IOS, "Model/BibleCatalog.swift"), path.join(IOS, "Model/ReadingPlanCatalog.swift"), path.join(IOS, "Model/ReadingPlans.swift"),
  path.join(IOS, "Model/PlanPlay.swift"), path.join(IOS, "Model/AppLocale.swift"), path.join(IOS, "Model/LocaleTables.swift"),
  path.join(ROOT, "tools/swift-harness/plans/main.swift"), "-o", bin], { stdio: "pipe" });
const swift = run(bin, [], "Swift harness");
let kotlin = null;
try {
  const newest = execFileSync("find", [path.join(ANDROID_ROOT, "core/src/main/kotlin"), "-name", "*.kt", "-newer", KOTLIN_BIN], { encoding: "utf8" }).trim();
  if (!existsSync(KOTLIN_BIN) || newest) execFileSync(path.join(ANDROID_ROOT, "gradlew"), [":core:installDist", "--quiet"], { cwd: ANDROID_ROOT, stdio: "pipe" });
  kotlin = run(KOTLIN_BIN, ["--plans"], "Kotlin harness");
} catch (err) { console.error("Kotlin 端跑不起来，本次只检 iOS ↔ TS：" + String(err.message).split("\n")[0]); }
const ts = run(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), path.join(ROOT, "tools/reading-plan-expect.mts")], "TS 期望值");

const problems = [], counts = {};
function cmp(other, name) {
  for (let i = 0; i < CASES.length; i++) {
    const kind = CASES[i][0];
    if (other[i] === "skip") continue;
    counts[kind] = (counts[kind] || 0) + 1;
    if (swift[i] !== other[i]) problems.push(`${CASES[i].join(" ")}\n      Swift: ${String(swift[i]).slice(0, 300)}\n      ${name}: ${String(other[i]).slice(0, 300)}`);
  }
}
cmp(ts, "TS");
if (kotlin) cmp(kotlin, "Kotlin");
// 硬断言：历元当天是第 1 天；52 阶；三循环旧约不含智慧书
if (swift[0] !== "1") problems.push(`复活节历元当天应为第 1 天，得到 ${swift[0]}`);
const curriculumIdx = CASES.findIndex((c) => c[0] === "curriculum");
if (swift[curriculumIdx].split(";").length !== 52) problems.push("新约深读不是 52 阶");
const ordersIdx = CASES.findIndex((c) => c[0] === "orders");
if (/\bPSA\b/.test(swift[ordersIdx].split("|")[0])) problems.push("三循环旧约轨里混进了智慧书");
if (problems.length) { console.error("读经计划自检失败："); for (const p of problems) console.error("  - " + p); process.exit(1); }
console.log(`读经计划自检通过：${CASES.length} 条用例三端一致${kotlin ? "" : "（Kotlin 端未参与）"}`);
console.log("  " + Object.entries(counts).map(([k, v]) => `${k} ${v / (kotlin ? 2 : 1)}`).join(" · "));
console.log(`  今日（${new Date().toISOString().slice(0, 10)}）三循环：${swift[CASES.findIndex((c) => c[0] === "triple" && c[1] === "157")]}（第 157 天示例）`);
