#!/usr/bin/env node
/**
 * 整章朗读音源自检。
 *
 * 分三步，缺一不可：
 *   1. 编译 iOS 的 ChapterAudioSource.swift 与 Android :core 的 Kotlin 版，各自生成 URL
 *   2. 两端 URL 必须逐条一致 —— 双写最容易在这里分叉（章号补零、OT/NT 分流、空格转义）
 *   3. 逐条发 Range 请求实测 —— URL 拼得对不等于拿得到音频
 *
 * 覆盖最容易拼错的几处：CUV 的三位章号补零、WEB 的 OT/NT 两个不同 base、
 * 书名含空格需转义（雅歌 / 哥林多前书）、没有音源的译本必须返回 nil。
 *
 *   node tools/chapter-audio-check.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = "AskBible.me/1.0 (iOS AVPlayer)";

const bin = path.join(mkdtempSync(path.join(tmpdir(), "audiourl-")), "bin");
execFileSync("swiftc", ["-O", "-swift-version", "5",
  path.join(ROOT, "apps/askbible-ios/AskBible/Audio/ChapterAudioSource.swift"),
  path.join(ROOT, "tools/swift-harness/audiourl/main.swift"),
  "-o", bin], { stdio: "pipe" });

const rows = JSON.parse(execFileSync(bin, { encoding: "utf8" }));

// Android 侧：core 是纯 JVM 模块，直接跑
const ANDROID_ROOT = path.join(ROOT, "apps/askbible-android");
const KOTLIN_BIN = path.join(ANDROID_ROOT, "core/build/install/core/bin/core");
let kotlinRows = null;
try {
  if (!existsSync(KOTLIN_BIN)) {
    execFileSync(path.join(ANDROID_ROOT, "gradlew"), [":core:installDist", "--quiet"],
      { cwd: ANDROID_ROOT, stdio: "pipe" });
  }
  kotlinRows = JSON.parse(execFileSync(KOTLIN_BIN, ["--audio"], { encoding: "utf8" }));
} catch (err) {
  console.error("Kotlin 端跑不起来，本次只检 iOS：" + String(err.message).split("\n")[0]);
}

// ust-en 在 RN 侧也没有整章音源，必须解析为 nil
const EXPECT_NO_AUDIO = new Set(["ust-en"]);

const problems = [];
const results = [];

// 先比两端 URL 是否逐条一致
if (kotlinRows) {
  if (kotlinRows.length !== rows.length) {
    problems.push(`两端用例数不同：iOS ${rows.length} / Android ${kotlinRows.length}`);
  } else {
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i], b = kotlinRows[i];
      // Swift 的 JSONEncoder 对 nil 字段是省略（读到 undefined），Kotlin 输出显式 null —— 归一化后再比
      const au = a.url ?? null, bu = b.url ?? null;
      if (au !== bu) {
        problems.push(`${a.translation} ${a.book} ${a.chapter}: 两端 URL 不一致\n` +
          `      iOS    : ${au ?? "null"}\n      Android: ${bu ?? "null"}`);
      }
    }
  }
}

for (const r of rows) {
  const label = `${r.translation} ${r.book} ${r.chapter}`;
  if (EXPECT_NO_AUDIO.has(r.translation)) {
    if (r.url) problems.push(`${label}: 该译本应无音源，却解析出 ${r.url}`);
    else results.push(`  ${label.padEnd(22)} 无音源（符合预期）`);
    continue;
  }
  if (!r.url) {
    problems.push(`${label}: 解析不出音源 URL`);
    continue;
  }
  // YouVersion：代理地址先问一次拿 CDN mp3（与 ChapterAudioSource.fetchResolved 同一条路）
  if (r.url.startsWith("https://askbible.me/api/read/chapter-audio")) {
    let src = "";
    try {
      const json = execFileSync("curl", ["-s", "--max-time", "30", "-H", "Accept: application/json", r.url], { encoding: "utf8" });
      src = String(JSON.parse(json).src || "");
    } catch { /* 下面按拿不到处理 */ }
    if (!src.startsWith("https://") || !src.includes("youversionapi.com")) { problems.push(`${label}: 代理没给出 mp3 — ${r.url}`); continue; }
    r.url = src;
  }
  let out;
  try {
    out = execFileSync("curl", ["-s", "-o", "/dev/null",
      "-w", "%{http_code} %{content_type}", "-r", "0-512",
      "-A", UA, "--max-time", "25", r.url], { encoding: "utf8" });
  } catch {
    problems.push(`${label}: 请求失败 ${r.url}`);
    continue;
  }
  const [code, type = ""] = out.trim().split(/\s+/);
  const ok = (code === "206" || code === "200") && type.startsWith("audio/");
  if (!ok) problems.push(`${label}: ${code} ${type} — ${r.url}`);
  results.push(`  ${label.padEnd(22)} ${code} ${type}`);
}

if (problems.length) {
  console.error(`整章音源自检失败：${problems.length} 项\n`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
const scope = kotlinRows ? "iOS + Android URL 一致，且实测可达" : "仅 iOS，实测可达";
console.log(`整章音源自检通过：${rows.length} 条（${scope}）`);
for (const r of results) console.log(r);
