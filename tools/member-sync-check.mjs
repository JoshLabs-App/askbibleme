#!/usr/bin/env node
// 会员读经同步纯规则对拍：逐键三方合并（书签 / 高亮 / 已读章 / 今日完成 / 比例 / 习惯日 / 听读秒 / 最近搜索 / 计划偏好 / 三循环 / 深读）、
// 整份推送合并（时间戳裁决）、归属判定、云端是否有进度、计划偏好是否上传、appLocale 侧车、连读、全年轴、时长文案、JS Date 语义，
// Swift（Model/MemberReadingSync.swift）↔ Kotlin（core MemberReadingSync.kt）↔ TS（RN member-sync + lib）。
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IOS = path.join(ROOT, "apps/askbible-ios/AskBible");
const ANDROID_ROOT = path.join(ROOT, "apps/askbible-android");
const KOTLIN_BIN = path.join(ANDROID_ROOT, "core/build/install/core/bin/core");
const J = (o) => JSON.stringify(o);
const NOW = "2026-09-09";
const T1 = "2026-09-01T00:00:00.000Z", T2 = "2026-09-05T10:20:30.500Z", T3 = "2026-09-08T23:59:59.000Z";
const blob = (updatedAt, value) => ({ updatedAt, value });
const bmA = { "cuv-simp:GEN:1:1": { bookId: "GEN", bookName: "创世记", chapter: 1, verse: 1, translationId: "cuv-simp", text: "起初", savedAt: 1700000000000 }, "cuv-simp:JHN:3:16": { bookId: "JHN", chapter: 3, verse: 16, translationId: "cuv-simp", text: "神爱世人", savedAt: 1700000005000, bookName: "约翰福音" } };
const bmB = { "cuv-simp:GEN:1:1": { bookId: "GEN", bookName: "创世记", chapter: 1, verse: 1, translationId: "cuv-simp", text: "起初（改）", savedAt: 1700000009000 }, "kjv:PSA:23:1": { bookId: "PSA", bookName: "Psalms", chapter: 23, verse: 1, translationId: "kjv", text: "The LORD", savedAt: 1690000000000 } };
const bmOld = { "cuv-simp:GEN:1:1": { bookId: "GEN", bookName: "创世记", chapter: 1, verse: 1, translationId: "cuv-simp", text: "旧", savedAt: 1600000000000 } };
const tripleA = { ot: { bookId: "EXO", chapter: 3 }, nt: { bookId: "MAT", chapter: 10 }, wisdom: { bookId: "PSA", chapter: 5 }, chaptersReadKeys: { ot: ["GEN:1", "GEN:2"], nt: ["MAT:1"], wisdom: [] }, chaptersRead: { ot: 2, nt: 1, wisdom: 0 }, startedAt: "2026-04-05" };
const tripleB = { ot: { bookId: "GEN", chapter: 40 }, nt: { bookId: "MRK", chapter: 2 }, wisdom: { bookId: "JOB", chapter: 9 }, chaptersReadKeys: { ot: ["GEN:2", "GEN:3", "bad"], nt: ["MAT:1", "MAT:2"], wisdom: ["JOB:1"] }, startedAt: "2026-04-01" };
const ntA = { ot: { bookId: "GEN", chapter: 12 }, curriculumIndex: 2, dayInSegment: 3, pace: 7, segmentDayTarget: 7, chaptersReadKeys: { ot: ["GEN:1"], nt: ["1JN:1", "1JN:2"] }, startedAt: "2026-08-01" };
const ntB = { ot: { bookId: "GEN", chapter: 15 }, curriculumIndex: 1, dayInSegment: 6, pace: 14, chaptersReadKeys: { ot: ["GEN:2"], nt: ["1JN:1"] }, startedAt: "2026-07-20" };
const ntC = { ot: { bookId: "EXO", chapter: 1 }, curriculumIndex: 2, dayInSegment: 5, pace: 7, chaptersReadKeys: { ot: [], nt: ["JHN:1"] }, startedAt: "2026-08-03" };
const planTriple = { version: 1, planId: "triple-loop", anchor: "calendar-easter", startedOn: "2026-04-05", dayCount: 1 };
const planTripleChosen = { ...planTriple, chosen: true, selectedAt: "2026-09-01T00:00:00.000Z", aheadDays: 2 };
const planNt = { version: 1, planId: "nt-deep-repeat", anchor: "from-today", startedOn: "2026-08-01", ntDeepRepeatPace: 7 };
const planNtChosen = { ...planNt, chosen: true, selectedAt: "2026-09-03T00:00:00.000Z", ntDeepRepeatPace: 14 };
const planEsv = { version: 1, planId: "esveverydayinword", anchor: "from-today", startedOn: "2026-06-01", dayCount: 365, chosen: true, selectedAt: "2026-06-01T08:00:00.000Z" };
const planEsvLater = { ...planEsv, startedOn: "2026-05-20", aheadDays: 4, selectedAt: "2026-06-01T08:00:00.000Z" };
const doneA = { version: 1, scopeKey: "triple-loop:epoch:150", doneKeys: ["nt:MAT:1", "ot:GEN:1"] };
const doneB = { version: 1, scopeKey: "triple-loop:epoch:151", doneKeys: ["nt:MAT:2"] };
const doneC = { version: 1, scopeKey: "esveverydayinword:day:3", doneKeys: ["GEN:1-2", "PSA:1-1", "MAT:1-1"] };
const fracA = { version: 1, scopeKey: "triple-loop:epoch:150", fractions: { "nt:MAT:1": 0.5, "ot:GEN:1": 1 } };
const fracB = { version: 1, scopeKey: "triple-loop:epoch:152", fractions: { "nt:MAT:1": 0.9, "wisdom:JOB:1": 0.25 } };
const fracC = { version: 1, scopeKey: "esveverydayinword:day:3", fractions: { "GEN:1-2": 0.3 }, updatedAt: T3 };
const fullBase = { bookmarks: blob(T1, bmA), chapterCompletion: blob(T1, { version: 1, completed: ["GEN:1", "GEN:2"] }), habitStats: blob(T2, { version: 1, completedDates: ["2026-09-01", "2026-09-02"] }),
  scriptureListenTotals: blob(T1, { version: 1, totalSec: 120 }), readingPlanPrefs: blob(T1, planTripleChosen), tripleLoopProgress: blob(T1, tripleA), appLocale: blob(T1, { version: 1, locale: "zh-CN", readingPlanPrefs: planTripleChosen }),
  homeNatureUi: blob(T1, { version: 1, softFocus: true }), musicVisualTheme: blob(T3, { version: 1, theme: "night" }) };
const fullIncoming = { bookmarks: blob(T2, bmB), chapterCompletion: blob(T3, { version: 1, completed: ["GEN:2", "EXO:1"] }), habitStats: blob(T1, { version: 1, completedDates: ["2026-09-02", "2026-09-05", "bad-date"] }),
  scriptureListenTotals: blob(T3, { version: 1, totalSec: 90.7 }), readingPlanPrefs: blob(T3, planNtChosen), tripleLoopProgress: blob(T2, tripleB), ntDeepRepeatProgress: blob(T2, ntA),
  lastPosition: blob(T2, { bookId: "JHN", chapter: 3, bookName: "约翰福音" }), recentSearches: blob(T2, { version: 1, terms: ["  神爱 世人 ", "love", "LOVE", "x"] }),
  musicVisualTheme: blob(T1, { version: 1, theme: "day" }), unknownKey: blob(T1, { x: 1 }), badBlob: { value: 1 }, todayReadingDone: blob("", doneA) };
const CASES = [
  ["merge", J(fullBase), J(fullIncoming), NOW], ["merge", "-", J(fullIncoming), NOW], ["merge", J(fullBase), "-", NOW],
  ["merge", J({ bookmarks: blob(T2, bmA) }), J({ bookmarks: blob(T1, bmB) }), NOW], ["merge", J({ bookmarks: blob(T1, bmOld) }), J({ bookmarks: blob(T1, bmB) }), NOW],
  ["mergeval", "bookmarks", J(bmA), J(bmB), NOW], ["mergeval", "bookmarks", "-", J(bmB), NOW], ["mergeval", "bookmarks", J(bmA), "null", NOW],
  ["mergeval", "highlights", J({ "GEN:1": [{ i: 3, c: "y" }, { i: 1, c: "g" }, { i: -1, c: "bad" }] }), J({ "GEN:1": [{ i: 3, c: "b" }, { i: 2.5, c: "x" }], "EXO:2": [{ i: 0, c: "p" }], "GEN:9": [] }), NOW],
  ["mergeval", "chapterCompletion", J({ version: 1, completed: ["GEN:2", "GEN:1"] }), J({ version: 1, completed: ["GEN:2", "EXO:10", 3] }), NOW],
  ["mergeval", "chapterCompletion", "-", J({ version: 1, completed: ["GEN:1"] }), NOW], ["mergeval", "chapterCompletion", J({ version: 1, completed: ["GEN:1"] }), J("str"), NOW],
  ["mergeval", "habitStats", J({ version: 1, completedDates: ["2026-09-03", "2026-09-01"] }), J({ version: 1, completedDates: ["2026-09-02", "2026-09-01"] }), NOW],
  // 使用时长 / 最近阅读上云（Josh 2026-09-11）：时长取大，最近阅读按「卷:章」并集取更晚的时间
  ["mergeval", "appUsageTime", J({ version: 1, totalSec: 900 }), J({ version: 1, totalSec: 120 }), NOW],
  ["mergeval", "appUsageTime", "-", J({ version: 1, totalSec: 30 }), NOW],
  ["mergeval", "recentChapters", J({ version: 1, items: [{ bookId: "GEN", chapter: 1, bookName: "创世记", at: 100 }] }),
   J({ version: 1, items: [{ bookId: "gen", chapter: 1, bookName: "Genesis", at: 300 }, { bookId: "MRK", chapter: 2, bookName: "马可福音", at: 200 }, { bookId: "", chapter: 3, bookName: "x", at: 1 }] }), NOW],
  ["mergeval", "recentChapters", J({ version: 1, items: [] }), J("str"), NOW],
  ["mergeval", "todayReadingDone", J(doneA), J({ ...doneA, doneKeys: ["ot:GEN:2"] }), NOW], ["mergeval", "todayReadingDone", J(doneA), J(doneB), NOW],
  ["mergeval", "todayReadingDone", J(doneA), J(doneC), NOW], ["mergeval", "todayReadingDone", J(doneC), J(doneA), NOW], ["mergeval", "todayReadingDone", J(doneA), J({ version: 1, scopeKey: "esveverydayinword:day:9", doneKeys: ["a", "b"] }), NOW],
  ["mergeval", "todayReadingDone", J({ version: 1, scopeKey: "", doneKeys: ["a"] }), J({ version: 1, scopeKey: "", doneKeys: ["b"] }), NOW],
  ["mergeval", "todayReadingFraction", J(fracA), J(fracB), NOW], ["mergeval", "todayReadingFraction", J(fracA), J(fracC), NOW], ["mergeval", "todayReadingFraction", J(fracC), J(fracA), NOW],
  ["mergeval", "todayReadingFraction", J({ version: 1, scopeKey: "", fractions: { a: 0.1 } }), J({ version: 1, fractions: { a: 0.2, b: "x" } }), NOW],
  ["mergeval", "scriptureListenTotals", J({ version: 1, totalSec: 120 }), J({ version: 1, totalSec: 90.9 }), NOW], ["mergeval", "scriptureListenTotals", J({ version: 2, totalSec: 1 }), J({ version: 1, totalSec: -5 }), NOW],
  ["mergeval", "scriptureListenTotals", J({ version: 1, totalSec: 10 }), J({ version: 1 }), NOW], ["mergeval", "scriptureListenTotals", "-", J({ version: 1, totalSec: 5.5 }), NOW],
  ["mergeval", "recentSearches", J({ version: 1, terms: ["爱", "faith", "b1", "b2", "b3", "b4", "b5"] }), J({ version: 1, terms: [" Faith ", "hope   now", "", "b6", "b7"] }), NOW],
  ["mergeval", "readingPlanPrefs", J(planTriple), J(planNtChosen), NOW], ["mergeval", "readingPlanPrefs", J(planNtChosen), J(planTriple), NOW], ["mergeval", "readingPlanPrefs", J(planTripleChosen), J(planNtChosen), NOW],
  ["mergeval", "readingPlanPrefs", J(planNtChosen), J(planTripleChosen), NOW], ["mergeval", "readingPlanPrefs", J(planEsv), J(planEsvLater), NOW], ["mergeval", "readingPlanPrefs", J(planEsvLater), J(planEsv), NOW],
  ["mergeval", "readingPlanPrefs", J({ ...planTripleChosen, aheadDays: 5 }), J({ ...planTripleChosen, aheadDays: 1, selectedAt: "2026-09-02T00:00:00.000Z" }), NOW],
  ["mergeval", "readingPlanPrefs", J({ ...planNt, chosen: true, selectedAt: "2026-09-04T00:00:00.000Z" }), J(planEsv), NOW], ["mergeval", "readingPlanPrefs", J(planNt), J(planEsv), NOW],
  ["mergeval", "readingPlanPrefs", "-", J(planEsv), NOW], ["mergeval", "readingPlanPrefs", J(planEsv), J(7), NOW], ["mergeval", "readingPlanPrefs", J({ version: 1, planId: "triple-loop", anchor: "calendar-easter", startedOn: "2026-04-05", aheadDays: 0 }), J({ version: 1, planId: "esveverydayinword", anchor: "from-today", startedOn: "2026-06-01", chosen: true }), NOW],
  ["mergeval", "tripleLoopProgress", J(tripleA), J(tripleB), NOW], ["mergeval", "tripleLoopProgress", J(tripleB), J(tripleA), NOW], ["mergeval", "tripleLoopProgress", "-", J(tripleA), NOW], ["mergeval", "tripleLoopProgress", J({ ot: { bookId: "ZZZ", chapter: 99 }, nt: { bookId: "REV", chapter: 40 }, wisdom: { bookId: "SNG", chapter: 0 } }), J({}), NOW],
  ["mergeval", "ntDeepRepeatProgress", J(ntA), J(ntB), NOW], ["mergeval", "ntDeepRepeatProgress", J(ntB), J(ntA), NOW], ["mergeval", "ntDeepRepeatProgress", J(ntA), J(ntC), NOW], ["mergeval", "ntDeepRepeatProgress", "-", J(ntA), NOW],
  ["mergeval", "lastPosition", J({ bookId: "GEN", chapter: 1 }), J({ bookId: "EXO", chapter: 2 }), NOW], ["mergeval", "appLocale", J({ version: 1, locale: "zh-CN" }), J({ version: 1, locale: "en" }), NOW], ["mergeval", "whatever", J(1), J(2), NOW],
  ["path", "", "0", "u1", "1", "0", "0"], ["path", "", "0", "u1", "0", "0", "0"], ["path", "", "0", "u1", "0", "1", "0"], ["path", "u1", "0", "u1", "1", "1", "0"], ["path", "u1", "0", "u1", "0", "0", "0"],
  ["path", "u2", "0", "u1", "0", "1", "1"], ["path", "u1", "1", "u1", "1", "1", "0"], ["path", "u1", "1", "u1", "1", "1", "1"], ["path", "", "1", "u1", "1", "0", "1"], ["path", "", "0", "u1", "1", "1", "1"],
  ["force", "sign-out"], ["force", "manual-debug"], ["force", "local-change"], ["force", "readingPlanPrefs"], ["force", "login"], ["force", ""],
  ["progress", "-"], ["progress", J({})], ["progress", J({ bookmarks: blob(T1, {}) })], ["progress", J({ bookmarks: blob(T1, bmOld) })], ["progress", J({ highlights: blob(T1, { "GEN:1": [] }) })], ["progress", J({ lastPosition: blob(T1, { bookId: "GEN", chapter: 1 }) })],
  ["progress", J({ chapterCompletion: blob(T1, { version: 1, completed: [] }) })], ["progress", J({ todayReadingDone: blob(T1, doneA) })], ["progress", J({ todayReadingFraction: blob(T1, { fractions: {} }) })], ["progress", J({ todayReadingFraction: blob(T1, fracA) })],
  ["progress", J({ habitStats: blob(T1, { completedDates: ["2026-01-01"] }) })], ["progress", J({ scriptureListenTotals: blob(T1, { totalSec: 0 }) })], ["progress", J({ scriptureListenTotals: blob(T1, { totalSec: 3 }) })],
  ["progress", J({ tripleLoopProgress: blob(T1, null) })], ["progress", J({ ntDeepRepeatProgress: blob(T1, ntA) })], ["progress", J({ readingPlanPrefs: blob(T1, planTriple) })], ["progress", J({ readingPlanPrefs: blob(T1, planTripleChosen) })], ["progress", J({ musicVisualTheme: blob(T1, { theme: "x" }) })],
  ["shouldsync", "-"], ["shouldsync", J(planTriple)], ["shouldsync", J(planTripleChosen)], ["shouldsync", J(planNt)], ["shouldsync", J({ ...planNt, ntDeepRepeatPace: 14 })], ["shouldsync", J(planEsv)], ["shouldsync", J({ ...planEsv, chosen: undefined })],
  ["shouldsync", J({ ...planTriple, aheadDays: 3 })], ["shouldsync", J({ ...planTriple, startedOn: "2026-04-06" })], ["shouldsync", J({ ...planTriple, version: 2 })], ["shouldsync", J({ ...planTriple, planId: " " })], ["shouldsync", J({ ...planTriple, ntDeepRepeatPace: 7 })],
  ["sidecar", J({ version: 1, locale: "en" }), J(planEsv)], ["sidecar", "-", J(planEsv)], ["sidecar", J("bad"), J(planTriple)],
  ["planid", J(fullBase)], ["planid", J({ appLocale: blob(T1, { version: 1, locale: "en", readingPlanPrefs: planEsv }) })], ["planid", J({ appLocale: blob(T1, { version: 1, locale: "en" }) })], ["planid", J({ readingPlanPrefs: blob(T1, { planId: "  " }), appLocale: blob(T1, { readingPlanPrefs: { planId: " x " } }) })], ["planid", "-"],
  ["scope", "triple-loop:epoch:1", "triple-loop:epoch:2"], ["scope", "a:day:1", "b:day:1"], ["scope", "same", "same"], ["scope", "", "x"], ["scope", ":day:1", "x"], ["scope", "  ", ""],
  ["streak", "2026-09-09,2026-09-08,2026-09-07", "2026-09-09"], ["streak", "2026-09-08,2026-09-07", "2026-09-09"], ["streak", "2026-09-06,2026-09-07", "2026-09-09"], ["streak", "", "2026-09-09"], ["streak", "2026-03-01,2026-02-28,2026-02-27", "2026-03-01"], ["streak", "2025-12-31,2026-01-01", "2026-01-02"],
  ["dates", "2026-09-03,2026-09-01,2026-09-03,bad,2026-9-1"], ["dates", ""],
  ["yeartl", "2026-01-01"], ["yeartl", "2026-09-09"], ["yeartl", "2026-12-31"], ["yeartl", "2024-12-31"], ["yeartl", "2024-02-29"],
  ["ranges", "2026-01-01,2026-01-02,2026-01-03,2026-01-05,2026-09-08,2026-09-09,2026-09-10,2025-12-31,bad", "2026-09-09"], ["ranges", "", "2026-09-09"], ["ranges", "2026-01-10", "2026-01-10"], ["ranges", "2026-01-09,2026-01-09", "2026-01-10"],
  ["fmtlisten", "0", "zh"], ["fmtlisten", "59", "zh"], ["fmtlisten", "2760", "zh"], ["fmtlisten", "3600", "zh"], ["fmtlisten", "30330", "en"], ["fmtlisten", "7200", "en"], ["fmtlisten", "-5", "en"],
  ["fmtusage", "0", "zh"], ["fmtusage", "59", "zh"], ["fmtusage", "60", "zh"], ["fmtusage", "125", "zh"], ["fmtusage", "3600", "zh"], ["fmtusage", "30330", "zh"], ["fmtusage", "125", "en"], ["fmtusage", "120", "en"], ["fmtusage", "7260", "en"], ["fmtusage", "7200", "en"], ["fmtusage", "7", "en"],
  ["parsems", "2026-09-09T22:00:00.000Z"], ["parsems", "2026-09-09T22:00:00Z"], ["parsems", "2026-09-09"], ["parsems", "2026-09-09T22:00:00.000+08:00"], ["parsems", ""], ["parsems", "1970-01-01T00:00:00.000Z"],
  ["iso", "0"], ["iso", "1788000000123"], ["iso", "1788000000000"],
];
const stdin = CASES.map((c) => c.join("\t")).join("\n") + "\n";
// TS 侧固定 UTC 跑：RN 的 year-day-timeline 用毫秒差除一天算「第几天」，夏令时月份会少算一天（RN 的坑）；
// 原生用日历天算不受夏令时影响，UTC 下两边才可比。
function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { input: stdin, encoding: "utf8", cwd: ROOT, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, TZ: "UTC" } });
  if (r.status !== 0) throw new Error(`${label} 跑失败：${(r.stderr || r.stdout).split("\n").slice(0, 8).join(" | ")}`);
  if (r.stderr?.trim()) console.error(r.stderr.trim());
  return JSON.parse(r.stdout);
}
const bin = path.join(mkdtempSync(path.join(tmpdir(), "membersync-")), "bin");
execFileSync("swiftc", ["-O", "-swift-version", "5",
  path.join(IOS, "Theme/ParchmentTheme.swift"), path.join(IOS, "Model/BibleCatalog.swift"), path.join(IOS, "Model/ReadingPlanCatalog.swift"), path.join(IOS, "Model/SiteCopy.swift"), path.join(IOS, "Model/ReadingPlans.swift"),
  path.join(IOS, "Model/PlanPlay.swift"), path.join(IOS, "Model/AppLocale.swift"), path.join(IOS, "Model/LocaleTables.swift"), path.join(IOS, "Model/MemberAuth.swift"), path.join(IOS, "Model/MemberOAuth.swift"), path.join(IOS, "Model/MemberReadingSync.swift"),
  path.join(ROOT, "tools/swift-harness/membersync/main.swift"), "-o", bin], { stdio: "pipe" });
const swift = run(bin, [], "Swift harness");
let kotlin = null;
try {
  const newest = execFileSync("find", [path.join(ANDROID_ROOT, "core/src/main/kotlin"), "-name", "*.kt", "-newer", KOTLIN_BIN], { encoding: "utf8" }).trim();
  if (!existsSync(KOTLIN_BIN) || newest) execFileSync(path.join(ANDROID_ROOT, "gradlew"), [":core:installDist", "--quiet"], { cwd: ANDROID_ROOT, stdio: "pipe" });
  kotlin = run(KOTLIN_BIN, ["--membersync"], "Kotlin harness");
} catch (err) { console.error("Kotlin 端跑不起来，本次只检 iOS ↔ TS：" + String(err.message).split("\n")[0]); }
const ts = run(process.execPath, [path.join(ROOT, "node_modules/tsx/dist/cli.mjs"), path.join(ROOT, "tools/member-sync-expect.mts")], "TS 期望值");
const problems = [], counts = {};
function cmp(other, name) {
  for (let i = 0; i < CASES.length; i++) {
    const kind = CASES[i][0];
    if (other[i] === "skip") continue;
    counts[kind] = (counts[kind] || 0) + 1;
    if (swift[i] !== other[i]) problems.push(`#${i} ${CASES[i].slice(0, 2).join(" ").slice(0, 90)}\n      Swift: ${String(swift[i]).slice(0, 320)}\n      ${name}: ${String(other[i]).slice(0, 320)}`);
  }
}
cmp(ts, "TS");
if (kotlin) cmp(kotlin, "Kotlin");
if (problems.length) { console.error("会员读经同步规则对拍失败："); for (const p of problems) console.error("  - " + p); process.exit(1); }
console.log(`会员读经同步规则对拍通过：${CASES.length} 条用例${kotlin ? "三端一致" : "iOS ↔ TS 一致（Kotlin 端未参与）"}`);
console.log("  " + Object.entries(counts).map(([k, v]) => `${k} ${v / (kotlin ? 2 : 1)}`).join(" · "));
