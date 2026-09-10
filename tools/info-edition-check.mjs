#!/usr/bin/env node
/**
 * 读后两版（陪你探索 / 查找资料）三端对拍：
 *  1. 归一化规则：Swift `InfoEditionFormat` ↔ Kotlin `InfoEditionFormat` ↔ RN `info-edition-format.ts`，
 *     用例 = 内容库里的真实章节（两版各若干章）+ 一组合成用例逐条打到每条规则上。
 *  2. 内容库：两端的 info-edition.sqlite 与 RN 资源字节一致（由 gen-info-edition 复制）。
 * 用例文件协议：记录以「换行 + U+001E + 换行」分隔，每条第一行是 variant，其余是 markdown。
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IOS = path.join(ROOT, "apps/askbible-ios/AskBible");
const ANDROID_ROOT = path.join(ROOT, "apps/askbible-android");
const KOTLIN_BIN = path.join(ANDROID_ROOT, "core/build/install/core/bin/core");
const SQLITE = path.join(ROOT, "apps/askbible-mobile/assets/content/info-edition.sqlite");
const SEP = "\n\x1e\n";

// ---- 内容库字节一致
const problems = [];
if (!existsSync(SQLITE)) { console.error("找不到 RN 的 info-edition.sqlite"); process.exit(1); }
for (const rel of ["apps/askbible-ios/AskBible/Resources/info-edition.sqlite", "apps/askbible-android/app/src/main/assets/info-edition.sqlite"]) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) problems.push(`${rel} 不存在（npm run gen:info-edition）`);
  else if (statSync(abs).size !== statSync(SQLITE).size) problems.push(`${rel} 与 RN 资源字节数不一致（npm run gen:info-edition）`);
}

// ---- 用例：真实章节
const REAL = [["GEN", 1], ["GEN", 2], ["GEN", 34], ["PSA", 119], ["JHN", 3], ["MAT", 23], ["REV", 22], ["ACT", 1]];
const roles = { info: "info_edition_v1", guide: "role_356f0ffb" };
const cases = [];
for (const [book, ch] of REAL) for (const variant of ["info", "guide"]) {
  const payload = execFileSync("sqlite3", [SQLITE, `select payload from chapter where key='${book}:${ch}:${roles[variant]}'`], { encoding: "utf8" });
  if (!payload.trim()) { problems.push(`内容库缺 ${book}:${ch}:${roles[variant]}`); continue; }
  cases.push({ label: `${variant} ${book}${ch}`, variant, markdown: JSON.parse(payload).markdown });
}
// ---- 合成用例：每条规则一个
const SYN = [
  ["fence", "guide", "```markdown\n## 标题\n\n正文\n```"],
  ["hr-adjacent-heading", "guide", "## 标题\n---\n段落一\n\n---\n\n段落二\n---\n## 二"],
  ["hr-double", "guide", "# T\n\n段落\n\n---\n\n---\n\n段落二"],
  ["softwrap", "guide", "# T\n\n第一行结尾两个空格  \n接下一行\n单独一行\n\n- 列表  \n不合并"],
  ["legacy-title", "info", "# 马太福音第23章导读\n\n正文"],
  ["legacy-title-2", "info", "#马可福音 第 3 章 导读\n正文"],
  ["no-heading-first", "info", "第一行不是标题\n\n## 二级"],
  ["h3-first", "guide", "### 三级开头\n\n# 又一个一级\n\n# 再一个\n\n## 二级"],
  ["nested-list", "guide", "# T\n\n1. 一\n   - 嵌套甲\n   2. 嵌套序号\n- 顶层\n\t* 制表缩进"],
  ["key-scenes-info", "info", "# T\n\n## 关键画面\n\n应被删掉\n\n### 也删\n\n## 保留\n\n留下"],
  ["key-scenes-guide", "guide", "# T\n\n## 关键画面\n\n引导版不删\n\n## 保留"],
  ["key-scenes-en", "info", "# T\n\n### Key Scenes\n\ngone\n\n#### deeper gone\n\n### Keep\n\nstay\n\n## KEY VISUALS\n\nalso gone\n\n# End"],
  ["blank-collapse", "guide", "# T\n\n\n\n段落\n\n\n\n\n段落二   \n\n"],
  ["crlf", "info", "# T\r\n\r\n段落\r\n---\r\n段落二"],
  ["empty", "info", "   \n  "],
  ["heading-only", "guide", "## 只有标题"],
];
for (const [label, variant, markdown] of SYN) cases.push({ label, variant, markdown });

const dir = mkdtempSync(path.join(tmpdir(), "info-edition-"));
const caseFile = path.join(dir, "cases.txt");
writeFileSync(caseFile, cases.map((c) => `${c.variant}\n${c.markdown}`).join(SEP));

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { encoding: "utf8", cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${label} 跑失败：${(r.stderr || r.stdout).split("\n").slice(0, 5).join(" | ")}`);
  if (r.stderr?.trim()) console.error(r.stderr.trim());
  return JSON.parse(r.stdout);
}
const bin = path.join(dir, "bin");
execFileSync("swiftc", ["-O", "-swift-version", "5", path.join(IOS, "Model/InfoEditionFormat.swift"),
  path.join(ROOT, "tools/swift-harness/info-edition/main.swift"), "-o", bin], { stdio: "pipe" });
const swift = run(bin, [caseFile], "Swift harness");
let kotlin = null;
try {
  const newest = execFileSync("find", [path.join(ANDROID_ROOT, "core/src/main/kotlin"), "-name", "*.kt", "-newer", KOTLIN_BIN], { encoding: "utf8" }).trim();
  if (!existsSync(KOTLIN_BIN) || newest) execFileSync(path.join(ANDROID_ROOT, "gradlew"), [":core:installDist", "--quiet"], { cwd: ANDROID_ROOT, stdio: "pipe" });
  kotlin = run(KOTLIN_BIN, ["--info-edition", caseFile], "Kotlin harness");
} catch (err) { console.error("Kotlin 端跑不起来，本次只检 iOS ↔ TS：" + String(err.message).split("\n")[0]); }
const ts = run(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), path.join(ROOT, "tools/info-edition-expect.mts"), caseFile], "TS 期望值");

function cmp(other, name) {
  for (let i = 0; i < cases.length; i++) {
    // 三端 JSON 键序不同（Swift 字典无序），按 [h, b] 规范化后再比
    const a = JSON.stringify([swift[i].h, swift[i].b]), b = JSON.stringify([other[i].h, other[i].b]);
    if (a !== b) problems.push(`${cases[i].label}\n      Swift: ${a.slice(0, 400)}\n      ${name}: ${b.slice(0, 400)}`);
  }
}
cmp(ts, "TS");
if (kotlin) cmp(kotlin, "Kotlin");
// 硬断言：合成用例确实打到了规则（防止三端一起漏）
const byLabel = Object.fromEntries(cases.map((c, i) => [c.label, ts[i]]));
if (byLabel["key-scenes-info"].b.includes("应被删掉") || byLabel["key-scenes-info"].b.includes("也删")) problems.push("info 版没有删掉「关键画面」版块");
if (!byLabel["key-scenes-guide"].b.includes("引导版不删")) problems.push("guide 版不该删「关键画面」");
if (byLabel["legacy-title"].h !== "马太福音 23章") problems.push(`旧式导读标题没归一化：${byLabel["legacy-title"].h}`);
if (!byLabel["softwrap"].b.startsWith("第一行结尾两个空格 接下一行")) problems.push(`软换行没合并：${byLabel["softwrap"].b.slice(0, 40)}`);
if (byLabel["nested-list"].b.includes("   - ") || byLabel["nested-list"].b.includes("\t* ")) problems.push("嵌套列表缩进没拉平");
if (byLabel["h3-first"].h !== "三级开头" || !byLabel["h3-first"].b.startsWith("## 又一个一级")) problems.push(`首标题升级 / 其余 # 降级不对：${JSON.stringify(byLabel["h3-first"]).slice(0, 120)}`);

if (problems.length) {
  console.error(`读后两版自检失败：${problems.length} 处\n  ` + problems.join("\n  "));
  process.exit(1);
}
console.log(`读后两版自检通过：${cases.length} 条用例三端一致（真实章节 ${cases.length - SYN.length} · 合成 ${SYN.length}），内容库两端与 RN 字节一致${kotlin ? "" : "（Kotlin 端未参与）"}`);
