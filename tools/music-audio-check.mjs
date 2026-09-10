#!/usr/bin/env node
/**
 * 音乐音源与专辑规则三方对拍（TS ↔ Swift ↔ Kotlin）。
 *
 * 曲库表由 tools/gen-music-catalog.mjs 从同一份 companion.json 生成，数据本身不会分叉；
 * 会分叉的是手写的：
 *   · src → 播放地址（内置 / Hymn Commons 直链 / R2 对象键），最容易在百分号编码、大小写、
 *     绝对地址取键这些地方写歪，而且一旦回落到 askbible.me 就是流量计费事故
 *   · 专辑别名归一、默认循环 / 音量 / 睡眠定时联动、切专辑起播曲
 * 三步：1) 先重新生成曲库；2) 三端各跑一遍同一批用例逐项比对；3) 抽两条真实地址发 Range 请求实测。
 *
 *   node tools/music-audio-check.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IOS = path.join(ROOT, "apps/askbible-ios/AskBible");
const ANDROID_ROOT = path.join(ROOT, "apps/askbible-android");
const KOTLIN_BIN = path.join(ANDROID_ROOT, "core/build/install/core/bin/core");

// 0. 曲库表与 companion.json 同步
execFileSync(process.execPath, [path.join(ROOT, "tools/gen-music-catalog.mjs")], { stdio: "pipe" });

const SRCS = [
  "/music/uploads/0e63e309c5fd4e518174ed84ee74b391.mp3",
  "music/uploads/no-leading-slash.mp3",
  "//music/uploads/double-slash.mp3",
  "https://askbible.me/music/uploads/must-not-use-origin.mp3",
  "https://cdn.example.com/x/y/music/uploads/nested.mp3",
  "https://hymncommons.org/wp-content/uploads/2020/01/Amazing%20Grace.mp3",
  "https://cdn.hymncommons.org/piano/track.MP3",
  "http://hymncommons.org/not-https.mp3",
  "https://hymncommons.org/x.wav",
  "/music/uploads/has/extra/segment.mp3",
  "/MUSIC/UPLOADS/upper.mp3",
  "/music/uploads/",
  "  /music/uploads/trimmed.mp3  ",
  "/other/path.mp3",
  "",
];
const RAWS = ["安静", "下午茶", "赞美诗", "钢琴", "睡眠", "专注工作", "放松", "休闲", "圣诗", "工作", "专注", "快乐", "", "  自定义  "];
const stdin = [SRCS.length, ...SRCS, RAWS.length, ...RAWS].join("\n") + "\n";

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { input: stdin, encoding: "utf8", cwd: ROOT });
  if (r.status !== 0) throw new Error(`${label} 跑失败：${(r.stderr || r.stdout).split("\n").slice(0, 4).join(" | ")}`);
  if (r.stderr?.trim()) console.error(r.stderr.trim());
  return JSON.parse(r.stdout);
}

// 1. Swift
const bin = path.join(mkdtempSync(path.join(tmpdir(), "musicaudio-")), "bin");
execFileSync("swiftc", ["-O", "-swift-version", "5",
  path.join(IOS, "Audio/MusicAudioSource.swift"),
  path.join(IOS, "Model/MusicCatalog.swift"),
  path.join(ROOT, "tools/swift-harness/musicaudio/main.swift"),
  "-o", bin], { stdio: "pipe" });
const swift = run(bin, [], "Swift harness");

// 2. Kotlin（core 是纯 JVM 模块）—— 源码比上次安装新就重装
let kotlin = null;
try {
  const srcDir = path.join(ANDROID_ROOT, "core/src/main/kotlin");
  const newest = execFileSync("find", [srcDir, "-name", "*.kt", "-newer", KOTLIN_BIN], { encoding: "utf8" }).trim();
  if (!existsSync(KOTLIN_BIN) || newest) {
    execFileSync(path.join(ANDROID_ROOT, "gradlew"), [":core:installDist", "--quiet"], { cwd: ANDROID_ROOT, stdio: "pipe" });
  }
  kotlin = run(KOTLIN_BIN, ["--music"], "Kotlin harness");
} catch (err) {
  console.error("Kotlin 端跑不起来，本次只检 iOS ↔ TS：" + String(err.message).split("\n")[0]);
}

// 3. TS（RN 原逻辑，经 tsx）
const ts = run(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), path.join(ROOT, "tools/music-audio-expect.mts")], "TS 期望值");

// Swift 的 JSONEncoder 省略 nil 字段、Kotlin/TS 输出显式 null —— 归一化后再比
function norm(v) {
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = norm(v[k]);
    return o;
  }
  return v === undefined ? null : v;
}
const NULLABLE = { urls: ["url"], rules: ["repeatMode", "sleepFrom0", "sleepFrom30"], starts: ["startId"] };
function fill(section, rows) {
  const keys = NULLABLE[section] || [];
  return rows.map((r) => { const o = { ...r }; for (const k of keys) if (!(k in o)) o[k] = null; return o; });
}

const problems = [];
const lines = [];
function compare(section, a, b, aName, bName, keyOf) {
  if (!a || !b) return;
  const A = fill(section, a), B = fill(section, b);
  if (A.length !== B.length) { problems.push(`${section}：${aName} ${A.length} 条 / ${bName} ${B.length} 条`); return; }
  let bad = 0;
  for (let i = 0; i < A.length; i++) {
    const x = JSON.stringify(norm(A[i])), y = JSON.stringify(norm(B[i]));
    if (x !== y) { bad++; problems.push(`${section} · ${keyOf(A[i])}\n      ${aName}: ${x}\n      ${bName}: ${y}`); }
  }
  lines.push(`  ${section.padEnd(9)} ${aName} ↔ ${bName}：${A.length} 条${bad ? `，${bad} 条不一致` : "一致"}`);
}
const keyOfUrl = (r) => JSON.stringify(r.src);
const keyOfNorm = (r) => JSON.stringify(r.raw);
const keyOfRule = (r) => r.album;
const keyOfStart = (r) => `${r.album} from ${r.from}`;

compare("urls", swift.urls, ts.urls, "Swift", "TS", keyOfUrl);
compare("normalize", swift.normalize, ts.normalize, "Swift", "TS", keyOfNorm);
if (ts.rules) compare("rules", swift.rules, ts.rules, "Swift", "TS", keyOfRule);
if (ts.starts) compare("starts", swift.starts, ts.starts, "Swift", "TS", keyOfStart);
if (kotlin) {
  compare("urls", swift.urls, kotlin.urls, "Swift", "Kotlin", keyOfUrl);
  compare("normalize", swift.normalize, kotlin.normalize, "Swift", "Kotlin", keyOfNorm);
  compare("rules", swift.rules, kotlin.rules, "Swift", "Kotlin", keyOfRule);
  compare("starts", swift.starts, kotlin.starts, "Swift", "Kotlin", keyOfStart);
}
// 曲库摘要三端一致（同一生成器出的，这里主要防 Swift/Kotlin 表被人手改）
for (const [name, other] of [["TS", ts], ["Kotlin", kotlin]]) {
  if (!other) continue;
  const a = JSON.stringify(norm(swift.catalog)), b = JSON.stringify(norm(other.catalog));
  if (a !== b) problems.push(`catalog 摘要 Swift ↔ ${name} 不一致\n      Swift: ${a}\n      ${name}: ${b}`);
}

// 硬规则：任何解析结果都不许落到 askbible.me
for (const r of [...swift.urls, ...(kotlin?.urls ?? [])]) {
  if (r.url && /askbible\.me/i.test(r.url)) problems.push(`解析到 askbible.me（流量计费）：${r.src} → ${r.url}`);
}
// 内置曲必须真的在两端安装包资源里
const gen = JSON.parse(readFileSync(path.join(ROOT, "tools/.music-catalog.json"), "utf8"));
for (const t of gen.filter((x) => x.bundled)) {
  for (const f of [path.join(IOS, "Resources", `${t.id}.mp3`), path.join(ANDROID_ROOT, "app/src/main/assets/music", `${t.id}.mp3`)]) {
    if (!existsSync(f)) problems.push(`内置曲缺文件：${f}`);
  }
}

// 4. 抽两条真实地址实测：一条 R2 点播、一条 Hymn Commons 直链
const probes = [];
const r2 = gen.find((t) => !t.bundled && t.album === "安静");
const hymn = gen.find((t) => /hymncommons\.org/i.test(t.src));
for (const t of [r2, hymn]) {
  if (!t) continue;
  const row = swift.urls.find((u) => u.src === t.src);
  const url = row?.url ?? (function () {
    // 用例表里没有就临时让 Swift 解析一次
    const r = spawnSync(bin, [], { input: `1\n${t.src}\n0\n`, encoding: "utf8" });
    return JSON.parse(r.stdout).urls[0].url;
  })();
  probes.push({ title: t.title || t.titleEn, url });
}
// R2 是我们自己的桶，取不到就是事故；Hymn Commons 是第三方站，偶尔超时只记 WARN（试两次、每次 15s）
for (const p of probes) {
  const thirdParty = /hymncommons\.org/i.test(p.url);
  let last = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(p.url, { headers: { Range: "bytes=0-1", "User-Agent": "AskBible.me/1.0 (iOS AVPlayer)" }, signal: AbortSignal.timeout(15000) });
      last = res.status === 206 || res.status === 200 ? null : `HTTP ${res.status}`;
      if (!last) { lines.push(`  实测 ${p.title}：HTTP ${res.status} ${res.headers.get("content-type") || ""} ${p.url}`); break; }
    } catch (err) {
      last = err.message;
    }
  }
  if (last) {
    if (thirdParty) console.error(`WARN 第三方直链 ${p.title} 本次取不到（${last}），不算失败：${p.url}`);
    else problems.push(`${p.title} 取不到音频：${last} ${p.url}`);
  }
}

if (problems.length) {
  console.error("音乐音源自检失败：");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`音乐音源自检通过：曲库 ${gen.length} 首（内置 ${gen.filter((t) => t.bundled).length} 首）${kotlin ? "" : "（Kotlin 端未参与）"}`);
for (const l of lines) console.log(l);
