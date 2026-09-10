#!/usr/bin/env node
/**
 * 经文搜索 + 收藏 + 译本偏好规则三端对拍：Swift `ScriptureSearchRules` / `VerseBookmarkRules` / `TranslationPrefsRules` ↔ Kotlin 同名 ↔ RN 真源
 * （`src/bible/scripture-search.ts`、`scripture-verse-bookmark-store.ts`、`scripture-recent-searches.ts`、`read-bible-translation-prefs.ts` 的纯函数）。
 * 用例一行一条（制表符分隔），三端各输出一行 JSON 字符串。
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IOS = path.join(ROOT, "apps/askbible-ios/AskBible");
const ANDROID_ROOT = path.join(ROOT, "apps/askbible-android");
const KOTLIN_BIN = path.join(ANDROID_ROOT, "core/build/install/core/bin/core");

const CASES = [
  ["norm", "  神 爱   世人 "], ["norm", "  爱   人  "], ["norm", ""], ["norm", "abc"],
  ["esc", "100%"], ["esc", "a_b\\c"], ["esc", "普通"],
  ["scope", "GEN", "1", "all", "", "0"], ["scope", "GEN", "1", "old", "", "0"], ["scope", "MAT", "1", "old", "", "0"],
  ["scope", "MAL", "4", "old", "", "0"], ["scope", "MAT", "1", "new", "", "0"], ["scope", "REV", "22", "new", "", "0"],
  ["scope", "GEN", "2", "chapter", "GEN", "2"], ["scope", "GEN", "3", "chapter", "GEN", "2"], ["scope", "GEN", "2", "chapter", "", "0"],
  ["scope", "XXX", "1", "old", "", "0"], ["scope", "PSA", "119", "new", "", "0"],
  ["split", "神爱世人，甚至将他的独生子赐给他们", "神"], ["split", "神爱世人", "人"], ["split", "神爱世人", "没有"],
  ["split", "Love LOVE love", "love"], ["split", "神爱世人", ""], ["split", "神爱世人", "  神  "], ["split", "aaa", "aa"],
  ["recent", "[]", "神"], ["recent", "[\"爱\",\"神\"]", "神"], ["recent", "[\"爱\",\"神\"]", " 神 "], ["recent", "[\"神\"]", "神"],
  ["recent", "[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\"]", "9"], ["recent", "[\"Love\"]", "love"], ["recent", "[\"a\"]", "   "],
  ["recentnorm", "[\"神\",\" 神\",\"爱\",\"\",\"爱 \",\"A\",\"a\",\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\"]"],
  ["bmkey", "cuv-simp", "GEN", "1", "1"],
  ["bmparse", "{}"], ["bmparse", "not json"], ["bmparse", ""],
  ["bmparse", "{\"cuv-simp:GEN:1:1\":{\"bookId\":\"gen\",\"bookName\":\"创世记\",\"chapter\":1,\"verse\":1,\"translationId\":\"cuv-simp\",\"text\":\"起初\",\"savedAt\":5}}"],
  ["bmparse", "{\"k\":{\"bookId\":\"GEN\",\"chapter\":0,\"verse\":1,\"translationId\":\"t\"},\"k2\":{\"bookId\":\"GEN\",\"chapter\":1,\"verse\":2,\"translationId\":\"t\"},\"k3\":{\"chapter\":1,\"verse\":1,\"translationId\":\"t\"},\"k4\":5}"],
  ["bmparse", "{\"a\":{\"bookId\":\"exo\",\"chapter\":2,\"verse\":3,\"translationId\":\"t\",\"text\":null,\"savedAt\":\"x\"}}"],

  ["tpparse", "", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "   ", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "not json", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "{\"version\":1,\"primaryTranslationId\":\"web-en\",\"contrastTranslationIds\":[\"cuv-simp\"],\"audioTranslationId\":null}", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "{\"version\":2,\"primaryTranslationId\":\"web-en\"}", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "{\"version\":\"1\",\"primaryTranslationId\":\"web-en\"}", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "{\"version\":1.0,\"primaryTranslationId\":\" web-en \"}", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "{\"version\":true,\"primaryTranslationId\":\"web-en\"}", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "{\"version\":1,\"primaryTranslationId\":\"kjv\",\"contrastTranslationIds\":[\"kjv\",\"web-en\"]}", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "{\"version\":1,\"primaryTranslationId\":\"web-en\",\"contrastTranslationIds\":[\"web-en\",\"\",5,\"ust-en\",\"cuv-trad\"]}", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "{\"version\":1,\"primaryTranslationId\":\"cuv-trad\",\"contrastTranslationId\":\"web-en\"}", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "{\"version\":1,\"primaryTranslationId\":\"cuv-trad\",\"contrastTranslationIds\":null,\"contrastTranslationId\":\"web-en\"}", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "{\"version\":1,\"primaryTranslationId\":\"cuv-trad\",\"contrastTranslationIds\":\"ust-en\",\"contrastTranslationId\":\"web-en\"}", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "{\"version\":1,\"primaryTranslationId\":\"cuv-simp\",\"contrastTranslationIds\":\"cuv-simp\"}", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "[1,2]", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "5", "cuv-simp,cuv-trad,web-en,ust-en", "cuv-simp"],
  ["tpparse", "{\"version\":1,\"primaryTranslationId\":\"web-en\"}", "web-en,ust-en", "ust-en"],
  ["tpparse", "{\"version\":1,\"primaryTranslationId\":\"kjv\"}", "web-en,ust-en", "ust-en"],
  ["tpser", "cuv-simp", ""],
  ["tpser", "web-en", "cuv-simp"],
  ["tpser", "web-en", "web-en"],
  ["tpser", "ust-en", "cuv-trad"],
];
const stdin = CASES.map((c) => c.join("\t")).join("\n") + "\n";

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { input: stdin, encoding: "utf8", cwd: ROOT });
  if (r.status !== 0) throw new Error(`${label} 跑失败：${(r.stderr || r.stdout).split("\n").slice(0, 5).join(" | ")}`);
  if (r.stderr?.trim()) console.error(r.stderr.trim());
  return JSON.parse(r.stdout);
}
const dir = mkdtempSync(path.join(tmpdir(), "scripture-search-"));
const bin = path.join(dir, "bin");
execFileSync("swiftc", ["-O", "-swift-version", "5",
  path.join(IOS, "Theme/ParchmentTheme.swift"), path.join(IOS, "Model/BibleCatalog.swift"),
  path.join(IOS, "Model/ScriptureSearch.swift"), path.join(IOS, "Model/VerseBookmarks.swift"), path.join(IOS, "Model/ScriptureDatabase.swift"),
  path.join(IOS, "Model/VerseAnnotations.swift"), path.join(IOS, "Model/TranslationPrefs.swift"),
  path.join(ROOT, "tools/swift-harness/scripture-search/main.swift"), "-o", bin], { stdio: "pipe" });
const swift = run(bin, [], "Swift harness");
let kotlin = null;
try {
  const newest = execFileSync("find", [path.join(ANDROID_ROOT, "core/src/main/kotlin"), "-name", "*.kt", "-newer", KOTLIN_BIN], { encoding: "utf8" }).trim();
  if (!existsSync(KOTLIN_BIN) || newest) execFileSync(path.join(ANDROID_ROOT, "gradlew"), [":core:installDist", "--quiet"], { cwd: ANDROID_ROOT, stdio: "pipe" });
  kotlin = run(KOTLIN_BIN, ["--scripture-search"], "Kotlin harness");
} catch (err) { console.error("Kotlin 端跑不起来，本次只检 iOS ↔ TS：" + String(err.message).split("\n")[0]); }
const ts = run(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), path.join(ROOT, "tools/scripture-search-expect.mts")], "TS 期望值");

const problems = [], counts = {};
// 三端里 JSON 的键序 / 非 ASCII 转义各不相同（Kotlin 写 \uXXXX、Swift 排序键），先规范化再比
function canon(v) {
  if (typeof v !== "string") return String(v);
  try {
    const sort = (x) => Array.isArray(x) ? x.map(sort) : (x && typeof x === "object")
      ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort(x[k])])) : x;
    return JSON.stringify(sort(JSON.parse(v)));
  } catch { return v; }
}
function cmp(other, name) {
  for (let i = 0; i < CASES.length; i++) {
    if (other[i] === "skip") continue;
    counts[CASES[i][0]] = (counts[CASES[i][0]] || 0) + 1;
    if (canon(swift[i]) !== canon(other[i])) problems.push(`${CASES[i].join(" ")}\n      Swift: ${String(swift[i]).slice(0, 300)}\n      ${name}: ${String(other[i]).slice(0, 300)}`);
  }
}
cmp(ts, "TS");
if (kotlin) cmp(kotlin, "Kotlin");
// 硬断言：规则确实生效
const at = (kind, i) => ts[CASES.findIndex((c, j) => c[0] === kind && CASES.slice(0, j).filter((x) => x[0] === kind).length === i)];
if (at("norm", 0) !== "神 爱 世人") problems.push(`normalize 没折叠空白：${at("norm", 0)}`);
if (at("esc", 1) !== "a\\_b\\\\c") problems.push(`LIKE 转义不对：${at("esc", 1)}`);
if (at("scope", 2) !== "0" || at("scope", 3) !== "1") problems.push("旧约范围判断不对（MAT 不在旧约 / MAL 在旧约）");
if (!at("split", 3).includes("\"match\":true")) problems.push("大小写不敏感切段失效");
if (JSON.parse(canon(at("recent", 4))).length !== 8 || JSON.parse(canon(at("recent", 4)))[0] !== "9") problems.push("最近搜索没有封顶 8 条 / 新的没在前");
const parsed = JSON.parse(canon(at("bmparse", 4)));
if (Object.keys(parsed).join(",") !== "k2") problems.push(`收藏解析没跳过坏条目：${Object.keys(parsed)}`);
if (canon(at("tpparse", 3)) !== canon("{\"primary\":\"web-en\",\"secondary\":\"cuv-simp\"}")) problems.push(`译本偏好解析不对：${at("tpparse", 3)}`);
if (canon(at("tpparse", 9)) !== canon("{\"primary\":\"web-en\",\"secondary\":\"ust-en\"}")) problems.push(`译本偏好对照没跳过主译本 / 空 / 非串：${at("tpparse", 9)}`);
if (at("tpser", 1) !== "{\"version\":1,\"primaryTranslationId\":\"web-en\",\"contrastTranslationIds\":[\"cuv-simp\"],\"audioTranslationId\":null}") problems.push(`译本偏好序列化与 RN 不同字：${at("tpser", 1)}`);

if (problems.length) {
  console.error(`经文搜索 / 收藏自检失败：${problems.length} 处\n  ` + problems.join("\n  "));
  process.exit(1);
}
console.log(`经文搜索 / 收藏自检通过：${CASES.length} 条用例三端一致${kotlin ? "" : "（Kotlin 端未参与）"}\n  ` +
  Object.entries(counts).map(([k, v]) => `${k} ${v / (kotlin ? 2 : 1)}`).join(" · "));
