#!/usr/bin/env node
/**
 * 防封换线的联网自检（docs/anti-block-endpoints.md）。要联网，所以不进 check:native。
 *
 * 把 iOS Endpoints.swift / 安卓 Endpoints.kt 各编成命令行跑一遍同一个场景：
 * 「上次缓存的线路、候选表第一条都是连不上的域」→ 探测完必须落到真源里的线路上，
 * 候选表被线上 endpoints.json 换掉，而且两端结果一致。
 *
 *   npm run check:endpoints:live
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANDROID_ROOT = path.join(ROOT, "apps/askbible-android");
const KOTLIN_BIN = path.join(ANDROID_ROOT, "core/build/install/core/bin/core");
const src = JSON.parse(readFileSync(path.join(ROOT, "data/endpoints.json"), "utf8"));
const noSlash = (s) => s.replace(/\/+$/, "");

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { encoding: "utf8", cwd: ROOT, timeout: 120_000 });
  if (r.status !== 0) throw new Error(`${label} 跑失败：${(r.stderr || r.stdout).split("\n").slice(0, 4).join(" | ")}`);
  return JSON.parse(r.stdout);
}

const bin = path.join(mkdtempSync(path.join(tmpdir(), "endpoints-")), "bin");
execFileSync("swiftc", ["-O", "-swift-version", "5", path.join(ROOT, "apps/askbible-ios/AskBible/Model/Endpoints.swift"),
  path.join(ROOT, "tools/swift-harness/endpoints/main.swift"), "-o", bin], { stdio: "pipe" });
const swift = run(bin, [], "Swift harness");

const newest = existsSync(KOTLIN_BIN)
  ? execFileSync("find", [path.join(ANDROID_ROOT, "core/src/main/kotlin"), "-name", "*.kt", "-newer", KOTLIN_BIN], { encoding: "utf8" }).trim()
  : "x";
if (newest) execFileSync(path.join(ANDROID_ROOT, "gradlew"), [":core:installDist", "--quiet"], { cwd: ANDROID_ROOT, stdio: "pipe" });
const kotlin = run(KOTLIN_BIN, ["--endpoints"], "Kotlin harness");

const problems = [];
const ROLES = ["media", "site", "api"];
for (const [name, got] of [["Swift", swift], ["Kotlin", kotlin]]) {
  ROLES.forEach((role, i) => {
    const want = src.roles[role].candidates;
    if (got.before[i] !== "https://blocked.invalid") problems.push(`${name} ${role}: 启动时没有先用缓存的线路（${got.before[i]}）`);
    if (!want.map(noSlash).includes(got.after[i])) problems.push(`${name} ${role}: 探测后没落到真源里的线路（${got.after[i]}）`);
    // 线上表在前、内置表垫后去重 —— 线上表和真源一致时就等于真源
    if (JSON.stringify(got[role]) !== JSON.stringify(want)) problems.push(`${name} ${role}: 候选表没被线上 endpoints.json 换掉：${JSON.stringify(got[role])}`);
  });
}
const canon = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
if (canon(swift) !== canon(kotlin)) problems.push(`两端结果不一致：\n    Swift  ${JSON.stringify(swift)}\n    Kotlin ${JSON.stringify(kotlin)}`);

if (problems.length) {
  console.error("防封换线联网自检失败：\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`防封换线联网自检通过：两端都从连不上的缓存线路换到了 ${swift.after.join(" · ")}`);
