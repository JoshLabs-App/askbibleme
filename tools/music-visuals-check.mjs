#!/usr/bin/env node
// 音乐页各专辑动画的参数对拍：鱼群种子 / 咖啡豆轨道与节点 / 星与流星 / 光球呼吸 / 行星，
// Swift（Model/MusicVisuals.swift）↔ Kotlin（core MusicVisuals.kt）↔ TS（RN 真源能纯净导入的部分：
// pseudoRandom01、coffeeOrbitLayout、coffeeBeanNodeLayout、专辑渐变表；鱼 / 星 / 流星的种子按 RN 公式在 expect 里照抄）。
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IOS = path.join(ROOT, "apps/askbible-ios/AskBible");
const ANDROID_ROOT = path.join(ROOT, "apps/askbible-android");
const KOTLIN_BIN = path.join(ANDROID_ROOT, "core/build/install/core/bin/core");

const CASES = [
  ["prand", "0"], ["prand", "1"], ["prand", "7"], ["prand", "33"], ["prand", "1234"], ["prand", "12345.5"],
  ["scene", "安静"], ["scene", "下午茶"], ["scene", "赞美诗"], ["scene", "钢琴"], ["scene", "睡眠"], ["scene", "专注工作"], ["scene", "未知"],
  ["fishseed", "0"], ["fishseed", "1"], ["fishseed", "11"], ["fishseed", "12"], ["fishseed", "57"], ["fishseed", "99"],
  ["fishframe", "0", "0"], ["fishframe", "5", "1234"], ["fishframe", "57", "60000"], ["fishframe", "99", "168000"],
  ["orbit", "390", "844", "844", "0"], ["orbit", "430", "932", "932", "0"], ["orbit", "360", "780", "780", "60"], ["orbit", "200", "300", "300", "0"],
  ["bean", "0", "390", "844"], ["bean", "1", "390", "844"], ["bean", "3", "390", "844"], ["bean", "4", "390", "844"], ["bean", "17", "430", "932"], ["bean", "33", "360", "780"],
  ["beanframe", "0", "390", "844", "0"], ["beanframe", "2", "390", "844", "5000"], ["beanframe", "9", "430", "932", "12345"], ["beanframe", "33", "390", "844", "99999"],
  ["star", "0", "390", "844", "0"], ["star", "7", "390", "844", "3000"], ["star", "27", "430", "932", "77777"],
  ["meteor", "0", "390", "844", "0"], ["meteor", "1", "390", "844", "8000"], ["meteor", "3", "430", "932", "20000"],
  ["glow", "0"], ["glow", "2700"], ["glow", "5400"], ["glow", "12345"],
  ["breath", "0"], ["breath", "3500"], ["breath", "7900"], ["breath", "16000"],
  ["planet", "0"], ["planet", "18000"], ["planet", "50000"],
];
const stdin = CASES.map((c) => c.join("\t")).join("\n") + "\n";
function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { input: stdin, encoding: "utf8", cwd: ROOT });
  if (r.status !== 0) throw new Error(`${label} 跑失败：${(r.stderr || r.stdout).split("\n").slice(0, 5).join(" | ")}`);
  if (r.stderr?.trim()) console.error(r.stderr.trim());
  return JSON.parse(r.stdout);
}
const bin = path.join(mkdtempSync(path.join(tmpdir(), "musicvis-")), "bin");
execFileSync("swiftc", ["-O", "-swift-version", "5", path.join(IOS, "Model/MusicVisuals.swift"), path.join(ROOT, "tools/swift-harness/musicvis/main.swift"), "-o", bin], { stdio: "pipe" });
const swift = run(bin, [], "Swift harness");
let kotlin = null;
try {
  const newest = execFileSync("find", [path.join(ANDROID_ROOT, "core/src/main/kotlin"), "-name", "*.kt", "-newer", KOTLIN_BIN], { encoding: "utf8" }).trim();
  if (!existsSync(KOTLIN_BIN) || newest) execFileSync(path.join(ANDROID_ROOT, "gradlew"), [":core:installDist", "--quiet"], { cwd: ANDROID_ROOT, stdio: "pipe" });
  kotlin = run(KOTLIN_BIN, ["--musicvis"], "Kotlin harness");
} catch (err) { console.error("Kotlin 端跑不起来，本次只检 iOS ↔ TS：" + String(err.message).split("\n")[0]); }
const ts = run(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), path.join(ROOT, "tools/music-visuals-expect.mts")], "TS 期望值");
// 三角函数在三门语言里最后一两位可能不同：数值逐个比对，容差 5e-4
function same(a, b) {
  if (a === b) return true;
  const pa = String(a).split(/[,|]/), pb = String(b).split(/[,|]/);
  if (pa.length !== pb.length) return false;
  return pa.every((x, i) => (x === pb[i]) || (Number.isFinite(Number(x)) && Number.isFinite(Number(pb[i])) && Math.abs(Number(x) - Number(pb[i])) <= 5e-4));
}
const problems = [], counts = {};
function cmp(other, name) {
  for (let i = 0; i < CASES.length; i++) {
    const kind = CASES[i][0];
    if (other[i] === "skip") continue;
    counts[kind] = (counts[kind] || 0) + 1;
    if (!same(swift[i], other[i])) problems.push(`${CASES[i].join(" ")}\n      Swift: ${String(swift[i]).slice(0, 240)}\n      ${name}: ${String(other[i]).slice(0, 240)}`);
  }
}
cmp(ts, "TS");
if (kotlin) cmp(kotlin, "Kotlin");
if (problems.length) { console.error("音乐动画参数对拍失败："); for (const p of problems) console.error("  - " + p); process.exit(1); }
console.log(`音乐动画参数对拍通过：${CASES.length} 条用例${kotlin ? "三端一致" : "iOS ↔ TS 一致（Kotlin 端未参与）"}`);
console.log("  " + Object.entries(counts).map(([k, v]) => `${k} ${v / (kotlin ? 2 : 1)}`).join(" · "));
