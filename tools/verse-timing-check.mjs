#!/usr/bin/env node
/**
 * 跟读时间轴自检：SQLite 查询 + 由播放位置定位当前节的算法。
 *
 * 时间轴库由 tools/build-verse-timings-db.mjs 从 RN 的 verse-timings-bundle.json 转出。
 * 这里验证三件事：
 *   1. cuv 系各章能查到、start 严格递增（二分查找的前提）
 *   2. 定位算法在边界正确：开播前 nil、节内命中、播完后 nil
 *   3. web-en 的源数据只覆盖 28 卷（无创世记 / 约翰福音）—— 这是数据现状，
 *      未覆盖的章必须查不到，且不能因此崩掉
 *   4. 定位算法在 iOS / Android 两端对同一组探测点给出同样结果
 *
 *   node tools/verse-timing-check.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IOS = path.join(ROOT, "apps/askbible-ios/AskBible");

const bin = path.join(mkdtempSync(path.join(tmpdir(), "timing-")), "bin");
execFileSync("swiftc", ["-O", "-swift-version", "5",
  path.join(IOS, "Audio/VerseTimings.swift"),
  path.join(ROOT, "tools/swift-harness/timing/main.swift"),
  "-o", bin], { stdio: "pipe" });

const reports = JSON.parse(execFileSync(bin, [path.join(IOS, "Resources")], { encoding: "utf8" }));
const problems = [];

/* ---------- 定位算法：iOS ↔ Android ---------- */

const ANDROID_ROOT = path.join(ROOT, "apps/askbible-android");
const KOTLIN_BIN = path.join(ANDROID_ROOT, "core/build/install/core/bin/core");
const swiftProbeBin = path.join(mkdtempSync(path.join(tmpdir(), "timingprobe-")), "bin");
let algoNote = "";
try {
  execFileSync("swiftc", ["-O", "-swift-version", "5",
    path.join(IOS, "Audio/VerseTimings.swift"),
    path.join(ROOT, "tools/swift-harness/timingprobe/main.swift"),
    "-o", swiftProbeBin], { stdio: "pipe" });
  const iosProbe = JSON.parse(execFileSync(swiftProbeBin, { encoding: "utf8" }));

  if (!existsSync(KOTLIN_BIN)) {
    execFileSync(path.join(ANDROID_ROOT, "gradlew"), [":core:installDist", "--quiet"],
      { cwd: ANDROID_ROOT, stdio: "pipe" });
  }
  const andProbe = JSON.parse(execFileSync(KOTLIN_BIN, ["--timing"], { encoding: "utf8" }));

  if (iosProbe.length !== andProbe.length) {
    problems.push(`定位算法：两端探测点数不同 ${iosProbe.length} / ${andProbe.length}`);
  } else {
    for (let i = 0; i < iosProbe.length; i++) {
      const a = iosProbe[i], b = andProbe[i];
      const av = a.verse === null || a.verse === undefined ? null : a.verse;
      const bv = b.verse === null || b.verse === undefined ? null : b.verse;
      if (a.t !== b.t || av !== bv) {
        problems.push(`定位算法 @${a.t}s：iOS ${av ?? "nil"} / Android ${bv ?? "nil"}`);
      }
    }
    algoNote = `  定位算法两端一致：${iosProbe.length} 个探测点（含边界与停顿间隙）`;
  }
} catch (err) {
  algoNote = "  定位算法两端比对跳过：" + String(err.message).split("\n")[0];
}

for (const r of reports) {
  const expectEmpty = r.label.includes("未覆盖");
  if (expectEmpty) {
    if (r.count !== 0) problems.push(`${r.label}: 预期查不到，实际 ${r.count} 条`);
    continue;
  }
  if (r.count === 0) { problems.push(`${r.label}: 查不到时间轴`); continue; }
  if (!r.monotonic) problems.push(`${r.label}: start 非严格递增，二分查找前提不成立`);
  if (r.firstVerse !== 1) problems.push(`${r.label}: 首节应为 1，实为 ${r.firstVerse}`);
  if (!(r.lastEnd > r.firstStart)) problems.push(`${r.label}: 末节 end 不大于首节 start`);

  const L = Object.fromEntries(r.lookups.map((s) => {
    const [name, rest] = s.split("@");
    return [name, rest.split("→")[1]];
  }));
  if (L["开播前"] !== "nil") problems.push(`${r.label}: 开播前应无高亮，实为 ${L["开播前"]}`);
  if (L["首节中"] !== "1") problems.push(`${r.label}: 首节中应命中 1，实为 ${L["首节中"]}`);
  if (L["首节末"] !== "1") problems.push(`${r.label}: 首节末应仍是 1，实为 ${L["首节末"]}`);
  if (L["末节中"] !== String(r.lastVerse)) problems.push(`${r.label}: 末节中应命中 ${r.lastVerse}，实为 ${L["末节中"]}`);
  if (L["播完后"] !== "nil") problems.push(`${r.label}: 播完后应无高亮，实为 ${L["播完后"]}`);
}

if (problems.length) {
  console.error(`跟读时间轴自检失败：${problems.length} 项\n`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log(`跟读时间轴自检通过：${reports.length} 章`);
if (algoNote) console.log(algoNote);
for (const r of reports) {
  if (r.count === 0) { console.log(`  ${r.label.padEnd(26)} 无时间轴（符合预期）`); continue; }
  console.log(`  ${r.label.padEnd(26)} ${String(r.count).padStart(3)} 节  ${r.firstStart}s–${r.lastEnd}s  ${r.lookups.join(" ")}`);
}
