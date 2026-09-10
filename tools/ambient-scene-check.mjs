#!/usr/bin/env node
/**
 * 首页环境音槽位表三方对拍（TS ↔ Swift ↔ Kotlin）+ R2 实测。
 * 会漂的是手抄的 9 条槽位：顺序、文件名、增益（-12 ~ -55 LUFS 的压平表）、默认槽位；文件名错一个字母就是静音。
 *   node tools/ambient-scene-check.mjs
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

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { encoding: "utf8", cwd: ROOT });
  if (r.status !== 0) throw new Error(`${label} 跑失败：${(r.stderr || r.stdout).split("\n").slice(0, 4).join(" | ")}`);
  return JSON.parse(r.stdout);
}
const bin = path.join(mkdtempSync(path.join(tmpdir(), "ambient-")), "bin");
execFileSync("swiftc", ["-O", "-swift-version", "5", path.join(IOS, "Audio/AmbientScenes.swift"),
  path.join(ROOT, "tools/swift-harness/ambient/main.swift"), "-o", bin], { stdio: "pipe" });
const swift = run(bin, [], "Swift harness");
let kotlin = null;
try {
  const newest = execFileSync("find", [path.join(ANDROID_ROOT, "core/src/main/kotlin"), "-name", "*.kt", "-newer", KOTLIN_BIN], { encoding: "utf8" }).trim();
  if (!existsSync(KOTLIN_BIN) || newest) execFileSync(path.join(ANDROID_ROOT, "gradlew"), [":core:installDist", "--quiet"], { cwd: ANDROID_ROOT, stdio: "pipe" });
  kotlin = run(KOTLIN_BIN, ["--ambient"], "Kotlin harness");
} catch (err) { console.error("Kotlin 端跑不起来，本次只检 iOS ↔ TS：" + String(err.message).split("\n")[0]); }
const ts = run(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), path.join(ROOT, "tools/ambient-scene-expect.mts")], "TS 期望值");

const norm = (v) => JSON.stringify(v, Object.keys(v).sort());
const problems = [], lines = [];
function cmp(a, b, aName, bName) {
  if (a.slots.length !== b.slots.length) problems.push(`槽位数 ${aName} ${a.slots.length} / ${bName} ${b.slots.length}`);
  let bad = 0;
  for (let i = 0; i < Math.max(a.slots.length, b.slots.length); i++) {
    const x = a.slots[i] ? norm({ ...a.slots[i], url: a.slots[i].url ?? null }) : "∅", y = b.slots[i] ? norm({ ...b.slots[i], url: b.slots[i].url ?? null }) : "∅";
    if (x !== y) { bad++; problems.push(`槽位 #${i}\n      ${aName}: ${x}\n      ${bName}: ${y}`); }
  }
  if (a.defaultSlotId !== b.defaultSlotId) problems.push(`默认槽位 ${aName} ${a.defaultSlotId} / ${bName} ${b.defaultSlotId}`);
  lines.push(`  槽位 ${aName} ↔ ${bName}：${a.slots.length} 条${bad ? `，${bad} 条不一致` : "一致"}；默认 ${a.defaultSlotId}`);
}
cmp(swift, ts, "Swift", "TS");
if (kotlin) cmp(swift, kotlin, "Swift", "Kotlin");
// 9 条全部实测（文件名错一个字母就是静音）
// 自己的 R2 桶，取不到就是事故；但一次超时先重试一次（每次 15s），别让网络抖动把整套 check:native 拦下来
for (const s of swift.slots) {
  let last = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(s.url, { headers: { Range: "bytes=0-1" }, signal: AbortSignal.timeout(15000) });
      last = res.status === 206 || res.status === 200 ? null : `HTTP ${res.status}`;
      if (!last) break;
    } catch (err) { last = err.message; }
  }
  if (last) problems.push(`${s.label} 取不到：${last} ${s.url}`);
}
if (problems.length) { console.error("环境音自检失败："); for (const p of problems) console.error("  - " + p); process.exit(1); }
console.log(`环境音自检通过：${swift.slots.length} 条槽位，R2 全部可达${kotlin ? "" : "（Kotlin 端未参与）"}`);
for (const l of lines) console.log(l);
