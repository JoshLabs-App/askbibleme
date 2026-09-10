#!/usr/bin/env node
/**
 * 经文标注切分的双端对拍。
 *
 * 设计 token 是常量，解析源码就能比；这里比的是**算法**（speech_spans 解码、
 * 按 UTF-16 码元切段、金句阈值），只能两端都真跑一遍。
 *
 *   TS 真源   : esbuild 打包 verse-annotations.ts 后直接 import
 *   Swift 实现: swiftc 把 App 里那份 VerseAnnotations.swift 和 harness 一起编译成命令行
 *   Kotlin 实现: gradle 装 :core（纯 JVM 模块，零 Android 依赖）后直接跑
 *
 * 样本从内置的真实圣经库里抽，覆盖：无 span / 单 span / 多 span / 神言 / 人言 /
 * 起止贴边 / 超长节，外加一组手写的脏输入（越界、乱序、非法 code、坏 JSON）。
 *
 *   node tools/verse-annotation-parity.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB = path.join(ROOT, "apps/askbible-mobile/assets/scripture/cuv-simp.sqlite");
const TS_SRC = path.join(ROOT, "apps/askbible-mobile/src/bible/verse-annotations.ts");
const SWIFT_IMPL = path.join(ROOT, "apps/askbible-ios/AskBible/Model/VerseAnnotations.swift");
const ANDROID_ROOT = path.join(ROOT, "apps/askbible-android");
const KOTLIN_BIN = path.join(ANDROID_ROOT, "core/build/install/core/bin/core");
const HARNESS = path.join(ROOT, "tools/swift-harness/main.swift");
const FIXTURE = path.join(ROOT, "shared-fixtures/verse-annotations.json");

const work = mkdtempSync(path.join(tmpdir(), "verse-parity-"));

/* ---------- 取样本 ---------- */

function sqlite(sql) {
  const out = execFileSync("sqlite3", ["-json", DB, sql], { encoding: "utf8", maxBuffer: 64 << 20 });
  return out.trim() ? JSON.parse(out) : [];
}

const SAMPLE_QUERIES = [
  ["无标注", "SELECT text, speech_spans AS spans, theme_repeat_count AS n FROM verse WHERE speech_spans = '' ORDER BY book_id, chapter, verse LIMIT 40"],
  ["单段神言", "SELECT text, speech_spans AS spans, theme_repeat_count AS n FROM verse WHERE speech_spans LIKE '[[%,1]]' AND speech_spans NOT LIKE '%],[%' LIMIT 60"],
  ["单段人言", "SELECT text, speech_spans AS spans, theme_repeat_count AS n FROM verse WHERE speech_spans LIKE '[[%,2]]' AND speech_spans NOT LIKE '%],[%' LIMIT 60"],
  ["多段", "SELECT text, speech_spans AS spans, theme_repeat_count AS n FROM verse WHERE speech_spans LIKE '%],[%' LIMIT 80"],
  ["从0起", "SELECT text, speech_spans AS spans, theme_repeat_count AS n FROM verse WHERE speech_spans LIKE '[[0,%' LIMIT 40"],
  ["长节", "SELECT text, speech_spans AS spans, theme_repeat_count AS n FROM verse WHERE speech_spans != '' ORDER BY length(text) DESC LIMIT 30"],
  ["金句边界", "SELECT text, speech_spans AS spans, theme_repeat_count AS n FROM verse WHERE theme_repeat_count BETWEEN 2 AND 4 LIMIT 40"],
];

const samples = [];
for (const [label, sql] of SAMPLE_QUERIES) {
  for (const row of sqlite(sql)) {
    samples.push({ label, text: row.text, spans: row.spans ?? "", themeRepeatCount: row.n ?? 0 });
  }
}

// 手写脏输入：真实库里不会有，但两端必须同样地拒绝
const HAND = [
  ["空 span", "神说：要有光。", "", 0],
  ["坏 JSON", "神说：要有光。", "[[0,3,", 0],
  ["非数组", "神说：要有光。", '{"a":1}', 0],
  ["越界", "神说：要有光。", "[[0,999,1]]", 0],
  ["end<=start", "神说：要有光。", "[[3,3,1]]", 0],
  ["负 start", "神说：要有光。", "[[-1,3,1]]", 0],
  ["非法 code", "神说：要有光。", "[[0,3,7]]", 0],
  ["小数", "神说：要有光。", "[[0.5,3,1]]", 0],
  ["乱序", "神说：要有光，就有了光。", "[[6,9,2],[0,3,1]]", 0],
  ["元素不足", "神说：要有光。", "[[0,3]]", 0],
  ["整节覆盖", "要有光", "[[0,3,1]]", 5],
  ["金句阈值-下", "测试", "", 2],
  ["金句阈值-上", "测试", "", 3],
  ["emoji 与代理对", "神说\u{1F54A}：要有光。", "[[0,2,1]]", 0],

  // 以下几条专抓「按 UTF-16 码元切」和「按字素簇切」的分歧。
  // 当前内置库 31100 节里没有任何非 BMP 字符，所以真实样本抓不到这个差异；
  // 将来译本若含 CJK 扩展区罕见汉字就会触发，这几条把盲区补上。
  ["代理对在 span 内", "\u{1F54A}神说：要有光。", "[[0,3,1]]", 0],
  ["代理对在 span 前", "\u{1F54A}神说：要有光。", "[[3,6,1]]", 0],
  ["代理对跨 span 边界", "神\u{1F54A}说：要有光。", "[[0,2,1]]", 0],
  ["CJK 扩展区汉字", "\u{20BB7}野家神说：要有光。", "[[0,2,1]]", 0],
  ["多个代理对", "\u{1F54A}\u{1F4D6}神说：要有光。", "[[0,5,1]]", 0],
];
for (const [label, text, spans, n] of HAND) {
  samples.push({ label, text, spans, themeRepeatCount: n });
}

/* ---------- TS 真源 ---------- */

const tsBundle = path.join(work, "ts.mjs");
execFileSync("npx", ["--no-install", "esbuild", TS_SRC, "--bundle", "--format=esm", "--platform=node", `--outfile=${tsBundle}`], { stdio: "pipe" });
const ts = await import(tsBundle);

const expected = samples.map((s) => ({
  parts: ts.speechPartsFromStoredSpans(s.text, s.spans),
  isGolden: ts.verseShowsGoldenThemeMarker(s.themeRepeatCount),
}));

/* ---------- Swift 实现 ---------- */

const bin = path.join(work, "harness");
execFileSync("swiftc", ["-O", "-swift-version", "5", SWIFT_IMPL, HARNESS, "-o", bin], { stdio: "pipe" });

const inputJson = JSON.stringify(samples.map((s) => ({ text: s.text, spans: s.spans, themeRepeatCount: s.themeRepeatCount })));
const actualRaw = execFileSync(bin, { input: inputJson, encoding: "utf8", maxBuffer: 64 << 20 });
const actual = JSON.parse(actualRaw);

/* ---------- Kotlin 实现 ---------- */

// core 是纯 JVM 模块，装一次就能反复跑；没装过则先 installDist
let kotlinActual = null;
try {
  if (!existsSync(KOTLIN_BIN)) {
    execFileSync(path.join(ANDROID_ROOT, "gradlew"), [":core:installDist", "--quiet"],
      { cwd: ANDROID_ROOT, stdio: "pipe" });
  }
  kotlinActual = JSON.parse(execFileSync(KOTLIN_BIN, {
    input: inputJson, encoding: "utf8", maxBuffer: 64 << 20,
  }));
} catch (err) {
  console.error("Kotlin 端跑不起来，本次只对拍 TS ↔ Swift：");
  console.error("  " + String(err.message).split("\n")[0]);
}

/* ---------- 比对 ---------- */

/**
 * JS 字符串允许持有孤立代理项，Swift 的 String 不允许（自动换成 U+FFFD）。
 * span 边界切在代理对中间时两端必然「不同」，但那是语言级的表示差异，不是切分错误 ——
 * 归一化后再比，切分位置真错了照样抓得到。这种边界本身是脏数据，正常库不会出现。
 */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const normalize = (parts) =>
  parts === null || parts === undefined
    ? null
    : parts.map((p) => ({ kind: p.kind, text: p.text.replace(LONE_SURROGATE, "\uFFFD") }));

const failures = [];
for (let i = 0; i < samples.length; i++) {
  const s = samples[i];
  const e = expected[i];
  const eParts = normalize(e.parts);

  const impls = [["Swift", actual[i]]];
  if (kotlinActual) impls.push(["Kotlin", kotlinActual[i]]);

  for (const [name, a] of impls) {
    if (!a) {
      failures.push({ label: s.label, impl: name, text: s.text, spans: s.spans,
                      ts: { parts: eParts, isGolden: e.isGolden }, got: null });
      continue;
    }
    const aParts = normalize(a.parts);
    if (JSON.stringify(eParts) !== JSON.stringify(aParts) || e.isGolden !== a.isGolden) {
      failures.push({
        label: s.label,
        impl: name,
        text: s.text.length > 46 ? s.text.slice(0, 46) + "…" : s.text,
        spans: s.spans,
        ts: { parts: eParts, isGolden: e.isGolden },
        got: { parts: aParts, isGolden: a.isGolden },
      });
    }
  }
}

writeFileSync(FIXTURE, JSON.stringify({
  note: "由 tools/verse-annotation-parity.mjs 生成。真源是 RN 的 verse-annotations.ts，勿手改。",
  generatedFrom: "apps/askbible-mobile/assets/scripture/cuv-simp.sqlite",
  sampleCount: samples.length,
  samples: samples.map((s, i) => ({ ...s, expected: expected[i] })),
}, null, 2) + "\n");

const byLabel = samples.reduce((m, s) => ((m[s.label] = (m[s.label] ?? 0) + 1), m), {});
const breakdown = Object.entries(byLabel).map(([k, v]) => `${k} ${v}`).join(" · ");

const impls = kotlinActual ? "Swift 与 Kotlin" : "Swift";
if (failures.length === 0) {
  console.log(`经文标注对拍通过：${samples.length} 条样本，TS 真源与 ${impls} 一致。`);
  console.log(`  覆盖：${breakdown}`);
  console.log(`  fixture 已更新：shared-fixtures/verse-annotations.json`);
  process.exit(0);
}

console.error(`经文标注实现分叉：${failures.length} 处不一致（${samples.length} 条样本 × ${impls}）\n`);
for (const f of failures.slice(0, 8)) {
  console.error(`  [${f.label}] "${f.text}"  spans=${f.spans}`);
  console.error(`    TS     : ${JSON.stringify(f.ts)}`);
  console.error(`    ${f.impl.padEnd(7)}: ${JSON.stringify(f.got)}\n`);
}
if (failures.length > 8) console.error(`  …还有 ${failures.length - 8} 条\n`);
console.error("真源是 RN 的 verse-annotations.ts。");
process.exit(1);
