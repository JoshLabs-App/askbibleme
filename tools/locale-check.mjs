#!/usr/bin/env node
/**
 * 语言展示规则三端对拍：Swift `AppLocale / ReadDisplayLocale / ZhTw / ReadChrome / BookRef.name`
 * ↔ Kotlin 同名 ↔ RN 真源（`i18n/config.ts` mapLanguageTagToAppLocale、`read/resolveReadDisplayLocale.ts`、
 * `i18n/site-copy.ts` toZhTwText、`bible/scripture-book-display-name.ts`）。
 * 用例一行一条（制表符分隔），三端各输出一行字符串。
 */
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
  ["tag", "en"], ["tag", "en-US"], ["tag", "zh-Hans-CN"], ["tag", "zh-CN"], ["tag", "zh-TW"], ["tag", "zh-Hant-HK"], ["tag", "zh-HK"],
  ["tag", "zh-MO"], ["tag", "zh"], ["tag", "ja-JP"], ["tag", ""], ["tag", "  ZH-hant  "], ["tag", "fr-CA"], ["tag", "english"],
  ["display", "zh-CN", "en"], ["display", "zh-CN", "zh-Hans"], ["display", "zh-TW", "zh-Hans"], ["display", "zh-CN", "zh-Hant"],
  ["display", "zh-TW", "zh-Hant"], ["display", "en", "zh-Hant"], ["display", "en", "en"], ["display", "zh-TW", ""], ["display", "en", ""],
  ["display", "zh-CN", " EN-GB "], ["display", "zh-CN", "es"],
  // chrome：目录分类 / 章标题这些我们自己的文字只有中英两套，外语译本回退英文
  ["chrome", "zh-CN", "fr"], ["chrome", "zh-TW", "fr"], ["chrome", "en", "fr"], ["chrome", "zh-CN", "es-ES"],
  ["chrome", "zh-CN", "zh-Hans"], ["chrome", "zh-TW", "zh-Hant"], ["chrome", "zh-CN", "en"], ["chrome", "zh-TW", ""],
  ["zhtw", "圣经"], ["zhtw", "旧约·新约·读经计划"], ["zhtw", "王后与太后来了"], ["zhtw", "走了一公里到这里"], ["zhtw", "仆人仆倒在地"],
  ["zhtw", "混沌中的创造开端"], ["zhtw", "Genesis 1"], ["zhtw", ""], ["zhtw", "设置里打开加载"], ["zhtw", "摩西五经"],
  ["book", "GEN", "en"], ["book", "GEN", "zh-CN"], ["book", "GEN", "zh-TW"], ["book", "PSA", "zh-TW"], ["book", "SNG", "zh-TW"], ["book", "2CO", "zh-TW"],
  ["book", "REV", "en"], ["book", "1TH", "zh-TW"], ["book", "JUD", "zh-CN"], ["book", "EZK", "zh-TW"],
  ["title", "创世记", "3", "zh-CN"], ["title", "Genesis", "3", "en"], ["title", "創世記", "150", "zh-TW"],
  ["label", "12", "zh-CN"], ["label", "12", "en"], ["label", "1", "zh-TW"],
];
const stdin = CASES.map((c) => c.join("\t")).join("\n") + "\n";

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { input: stdin, encoding: "utf8", cwd: ROOT });
  if (r.status !== 0) throw new Error(`${label} 跑失败：${(r.stderr || r.stdout).split("\n").slice(0, 5).join(" | ")}`);
  if (r.stderr?.trim()) console.error(r.stderr.trim());
  return JSON.parse(r.stdout);
}
const dir = mkdtempSync(path.join(tmpdir(), "locale-"));
const bin = path.join(dir, "bin");
execFileSync("swiftc", ["-O", "-swift-version", "5",
  path.join(IOS, "Theme/ParchmentTheme.swift"), path.join(IOS, "Model/BibleCatalog.swift"),
  path.join(IOS, "Model/LocaleTables.swift"), path.join(IOS, "Model/AppLocale.swift"),
  path.join(ROOT, "tools/swift-harness/locale/main.swift"), "-o", bin], { stdio: "pipe" });
const swift = run(bin, [], "Swift harness");
let kotlin = null;
try {
  const newest = execFileSync("find", [path.join(ANDROID_ROOT, "core/src/main/kotlin"), "-name", "*.kt", "-newer", KOTLIN_BIN], { encoding: "utf8" }).trim();
  if (!existsSync(KOTLIN_BIN) || newest) execFileSync(path.join(ANDROID_ROOT, "gradlew"), [":core:installDist", "--quiet"], { cwd: ANDROID_ROOT, stdio: "pipe" });
  kotlin = run(KOTLIN_BIN, ["--locale"], "Kotlin harness");
} catch (err) { console.error("Kotlin 端跑不起来，本次只检 iOS ↔ TS：" + String(err.message).split("\n")[0]); }
const ts = run(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), path.join(ROOT, "tools/locale-expect.mts")], "TS 期望值");

const problems = [], counts = {};
function cmp(other, name) {
  for (let i = 0; i < CASES.length; i++) {
    if (other[i] === "skip") continue;
    counts[CASES[i][0]] = (counts[CASES[i][0]] || 0) + 1;
    if (swift[i] !== other[i]) problems.push(`${CASES[i].join(" ")}\n      Swift: ${swift[i]}\n      ${name}: ${other[i]}`);
  }
}
cmp(ts, "TS");
if (kotlin) cmp(kotlin, "Kotlin");
const at = (kind, i) => ts[CASES.findIndex((c, j) => c[0] === kind && CASES.slice(0, j).filter((x) => x[0] === kind).length === i)];
if (at("tag", 5) !== "zh-TW" || at("tag", 8) !== "zh-CN" || at("tag", 9) !== "en") problems.push("语言标签映射不对（Hant→繁 / zh→简 / 其它→en）");
if (at("chrome", 0) !== "en" || at("chrome", 1) !== "en" || at("chrome", 5) !== "zh-TW" || at("chrome", 7) !== "zh-TW")
  problems.push("外语译本的目录 / 章标题没有回退英文");
if (at("display", 0) !== "en" || at("display", 2) !== "zh-TW" || at("display", 5) !== "zh-CN") problems.push("读经展示语言没跟译本走");
if (at("zhtw", 2) !== "王后與太后來了" || at("zhtw", 3) !== "走了一公里到這裡") problems.push(`简→繁修正词没生效：${at("zhtw", 2)} / ${at("zhtw", 3)}`);
if (at("book", 2) !== "創世記") problems.push(`繁体书名不对：${at("book", 2)}`);

if (problems.length) {
  console.error(`语言展示自检失败：${problems.length} 处\n  ` + problems.join("\n  "));
  process.exit(1);
}
console.log(`语言展示自检通过：${CASES.length} 条用例三端一致${kotlin ? "" : "（Kotlin 端未参与）"}\n  ` +
  Object.entries(counts).map(([k, v]) => `${k} ${v / (kotlin ? 2 : 1)}`).join(" · "));
