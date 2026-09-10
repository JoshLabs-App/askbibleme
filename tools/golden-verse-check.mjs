#!/usr/bin/env node
/**
 * 首页金句三方对拍（TS ↔ Swift ↔ Kotlin）+ 数据自检。
 *
 * 会分叉的手写逻辑：
 *   · 经文键解析 → 音频对象键（区间取起点、大小写、非法键必须 null）
 *   · 选句算法（权重 + 间隔记忆）：喂同一串固定随机数与时间，三端必须选出同一串句子、
 *     留下同一份记忆表 —— rng 的消耗次数也要一致，少调一次 rng 整条序列就错位
 * 数据自检：两端打进包的 manifest 必须与 RN 的逐字节相同；manifest 里每一节在内置 cuv-simp 库里
 * 都查得到，且抽查 chunk 的 zh-CN 正文与库里逐字相同（原生正文取自库，不是 chunk）。
 *
 *   node tools/golden-verse-check.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IOS = path.join(ROOT, "apps/askbible-ios/AskBible");
const ANDROID_ROOT = path.join(ROOT, "apps/askbible-android");
const MOBILE = path.join(ROOT, "apps/askbible-mobile");
const KOTLIN_BIN = path.join(ANDROID_ROOT, "core/build/install/core/bin/core");

const KEYS = ["GEN.1.1", "gen.1.1", " PRO.3.5 ", "GEN.1.1-GEN.1.3", "1CO.13.4", "PSA.119.176", "SNG.2.1",
  "GEN.1", "GEN.0.1", "GEN.1.0", "G.1.1", "TOOLONGBOOK.1.1", "GEN.1.1-", "GEN.1.1-x", "", "GEN.01.007"];
// 6 节的小池子，权重故意拉开；rng 序列覆盖复习分支（< 0.72）与全池分支（≥ 0.72）
const ENTRIES = [["GEN.1.1", 13], ["GEN.1.27", 41], ["PSA.23.1", 30], ["JHN.3.16", 60], ["ROM.8.28", 25], ["PHP.4.13", 5]];
const RNG = [0.05, 0.91, 0.30, 0.66, 0.73, 0.12, 0.99, 0.41, 0.58, 0.20, 0.85, 0.07, 0.49, 0.77, 0.33, 0.95,
  0.61, 0.18, 0.88, 0.26, 0.70, 0.02, 0.44, 0.79, 0.15, 0.53, 0.97, 0.38, 0.64, 0.09, 0.82, 0.23, 0.71, 0.36, 0.90, 0.11];
const H = 60 * 60 * 1000;
// 前 6 次同一时刻（全部到期）；再跳 7 小时（第一批复现）；再跳 2 天；最后一次远未来
const NOWS = [1e12, 1e12, 1e12, 1e12, 1e12, 1e12, 1e12 + 7 * H, 1e12 + 7 * H, 1e12 + 55 * H, 1e12 + 55 * H, 1e12 + 30 * 24 * H, 1e12 + 30 * 24 * H];
// 去括注用例：合成的边角 + 抽查 chunk 对应的库内原文（原生正文取自库再去括注，必须等于 chunk 的 zh-CN 行）
const SYNTHETIC_TEXTS = [
  "（大卫上行之诗）人对我说：我们往耶和华的殿去，我就欢喜。",
  "(上行之诗) （大卫的诗）耶和华是我的牧者。",
  "耶和华〔原文作雅威〕是我的牧者。",
  "  （题注）  正文  两个  空格  ",
  "（）",
  "（只有题注）",
  "\u3000全角空格开头\u3000",
  "〔没配对的译注 正文",
  "\u00a0nbsp 开头与结尾\u00a0",
  // 下面三条专门卡「用了各语言自带的 trim / \s」：JS 剥 U+FEFF、不剥 U+001F；Java 的 \s 不认 NBSP
  "\ufeff带 BOM 开头与结尾\ufeff",
  "\u001f单元分隔符开头 正文",
  "正文\u00a0\u00a0两个 NBSP 要折成一个空格",
  "",
];
const manifestSrc = readFileSync(path.join(MOBILE, "assets/content/home-prayer-pools/theme-repeat-ge5/manifest.json"));
const manifest = JSON.parse(manifestSrc.toString("utf8"));
let stmt = null;
try {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path.join(MOBILE, "assets/scripture/cuv-simp.sqlite"), { readOnly: true });
  stmt = db.prepare("SELECT text FROM verse WHERE book_id = ? AND chapter = ? AND verse = ?");
} catch (err) {
  console.error("node:sqlite 不可用，跳过库内核对：" + String(err.message).split("\n")[0]);
}
const sampled = []; // {verseKey, dbText, chunkText}
if (stmt) {
  for (const ci of [0, 50, 150, 211]) {
    const f = path.join(MOBILE, `assets/content/home-prayer-pools/theme-repeat-ge5/chunk-${ci}.json`);
    if (!existsSync(f)) continue;
    for (const v of JSON.parse(readFileSync(f, "utf8")).verses) {
      const [b, c, vv] = v.verseKey.split(".");
      const row = stmt.get(b, Number(c), Number(vv));
      sampled.push({ verseKey: v.verseKey, dbText: row?.text ?? "", chunkText: v.locales["zh-CN"].lines.join("") });
    }
  }
}
const TEXTS = [...SYNTHETIC_TEXTS, ...sampled.map((s) => s.dbText)];
const stdin = [KEYS.length, ...KEYS, ENTRIES.length, ...ENTRIES.map((e) => e.join(" ")), RNG.length, ...RNG, NOWS.length, ...NOWS, TEXTS.length, ...TEXTS].join("\n") + "\n";

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { input: stdin, encoding: "utf8", cwd: ROOT });
  if (r.status !== 0) throw new Error(`${label} 跑失败：${(r.stderr || r.stdout).split("\n").slice(0, 4).join(" | ")}`);
  if (r.stderr?.trim()) console.error(r.stderr.trim());
  return JSON.parse(r.stdout);
}

const bin = path.join(mkdtempSync(path.join(tmpdir(), "golden-")), "bin");
execFileSync("swiftc", ["-O", "-swift-version", "5",
  path.join(IOS, "Audio/GoldenVerseAudioSource.swift"),
  path.join(IOS, "Home/HomeVersePool.swift"),
  path.join(IOS, "Model/VerseDisplayNotes.swift"),
  path.join(ROOT, "tools/swift-harness/golden/main.swift"),
  "-o", bin], { stdio: "pipe" });
const swift = run(bin, [], "Swift harness");

let kotlin = null;
try {
  const srcDir = path.join(ANDROID_ROOT, "core/src/main/kotlin");
  const newest = execFileSync("find", [srcDir, "-name", "*.kt", "-newer", KOTLIN_BIN], { encoding: "utf8" }).trim();
  if (!existsSync(KOTLIN_BIN) || newest) {
    execFileSync(path.join(ANDROID_ROOT, "gradlew"), [":core:installDist", "--quiet"], { cwd: ANDROID_ROOT, stdio: "pipe" });
  }
  kotlin = run(KOTLIN_BIN, ["--golden"], "Kotlin harness");
} catch (err) {
  console.error("Kotlin 端跑不起来，本次只检 iOS ↔ TS：" + String(err.message).split("\n")[0]);
}
const ts = run(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), path.join(ROOT, "tools/golden-verse-expect.mts")], "TS 期望值");

function norm(v) {
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v).sort()) o[k] = norm(v[k]); return o; }
  return v === undefined ? null : v;
}
const problems = [];
const lines = [];
function cmp(label, a, b, aName, bName) {
  const x = JSON.stringify(norm(a)), y = JSON.stringify(norm(b));
  if (x !== y) problems.push(`${label} ${aName} ↔ ${bName} 不一致\n      ${aName}: ${x.slice(0, 400)}\n      ${bName}: ${y.slice(0, 400)}`);
  else lines.push(`  ${label.padEnd(8)} ${aName} ↔ ${bName} 一致`);
}
function cmpPaths(a, b, aName, bName) {
  const A = a.map((r) => ({ ...r, cuv: r.cuv ?? null, web: r.web ?? null, url: r.url ?? null }));
  const B = b.map((r) => ({ ...r, cuv: r.cuv ?? null, web: r.web ?? null, url: r.url ?? null }));
  let bad = 0;
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = JSON.stringify(norm(A[i])), y = JSON.stringify(norm(B[i]));
    if (x !== y) { bad++; problems.push(`paths · ${JSON.stringify(KEYS[i])}\n      ${aName}: ${x}\n      ${bName}: ${y}`); }
  }
  lines.push(`  paths    ${aName} ↔ ${bName}：${A.length} 条${bad ? `，${bad} 条不一致` : "一致"}`);
}
for (const [name, other] of [["TS", ts], ["Kotlin", kotlin]]) {
  if (!other) continue;
  cmpPaths(swift.paths, other.paths, "Swift", name);
  cmp("picks", swift.picks, other.picks, "Swift", name);
  cmp("memory", swift.memory, other.memory, "Swift", name);
  cmp("rngUsed", swift.rngUsed, other.rngUsed, "Swift", name);
  let bad = 0;
  for (let i = 0; i < TEXTS.length; i++) {
    const x = swift.strips[i]?.out, y = other.strips[i]?.out;
    if (x !== y) { bad++; if (bad <= 4) problems.push(`strip · ${JSON.stringify(TEXTS[i]).slice(0, 60)}\n      Swift: ${JSON.stringify(x)}\n      ${name}: ${JSON.stringify(y)}`); }
  }
  lines.push(`  strip    Swift ↔ ${name}：${TEXTS.length} 条${bad ? `，${bad} 条不一致` : "一致"}`);
}
// 选句序列必须真的覆盖到两条分支（不然对拍等于没拍）
if (new Set(swift.picks).size < 3) problems.push(`选句序列只有 ${new Set(swift.picks).size} 种句子，用例太弱`);
for (const r of swift.paths) if (r.url && /askbible\.me/i.test(r.url)) problems.push(`解析到 askbible.me：${r.key} → ${r.url}`);

// 数据自检：manifest 逐字节相同
const sha = (b) => createHash("sha256").update(b).digest("hex");
for (const f of [path.join(IOS, "Resources/home-verse-manifest.json"), path.join(ANDROID_ROOT, "app/src/main/assets/home-verse-manifest.json")]) {
  if (!existsSync(f)) problems.push(`缺 manifest：${f}`);
  else if (sha(readFileSync(f)) !== sha(manifestSrc)) problems.push(`manifest 与 RN 不同：${f}`);
}
lines.push(`  金句池 ${manifest.entries.length} 节，两端 manifest 与 RN 逐字节相同`);

// manifest 每节都在内置 cuv-simp 库里；抽查：库内原文去括注后必须与 chunk 的 zh-CN 行逐字相同
if (stmt) {
  let missing = 0;
  for (const e of manifest.entries) {
    const [b, c, v] = e.verseKey.split(".");
    if (!stmt.get(b, Number(c), Number(v))) { missing++; if (missing <= 3) problems.push(`manifest 节在库里查不到：${e.verseKey}`); }
  }
  if (missing > 3) problems.push(`…共 ${missing} 节查不到`);
  let diff = 0, stripped = 0;
  sampled.forEach((row, i) => {
    const out = ts.strips[SYNTHETIC_TEXTS.length + i]?.out;
    if (out !== row.chunkText) { diff++; if (diff <= 3) problems.push(`正文不同 ${row.verseKey}\n      库(去括注): ${out}\n      chunk: ${row.chunkText}`); }
    if (row.dbText !== row.chunkText) stripped++;
  });
  lines.push(`  库内核对：manifest ${manifest.entries.length} 节全部命中；抽查 ${sampled.length} 节去括注后与 chunk 相同（其中 ${stripped} 节确实带题注）${diff ? `，${diff} 节不同` : ""}`);
}

if (problems.length) {
  console.error("金句自检失败：");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`金句自检通过${kotlin ? "" : "（Kotlin 端未参与）"}：${KEYS.length} 条经文键、${NOWS.length} 次选句`);
for (const l of lines) console.log(l);
console.log(`  选句序列：${swift.picks.join(" → ")}`);
