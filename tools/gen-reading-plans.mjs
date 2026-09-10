#!/usr/bin/env node
/**
 * 读经计划目录 + 文案 → 两端静态表；日课表 JSON 原样拷进两端包。
 *
 * 真源：data/bible-reading-plans/registry.json（11 个经典日课表）+ 代码内置的两个主推计划
 * （三循环 / 新约深读，与 lib/bible/reading-plans/{triple-loop,nt-deep-repeat}-plan.ts 同）
 * + apps/askbible-mobile/assets/content/zh-CN.json 里 pages.read.* 文案。
 *
 *   node tools/gen-reading-plans.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(readFileSync(path.join(ROOT, "data/bible-reading-plans/registry.json"), "utf8"));
const zh = JSON.parse(readFileSync(path.join(ROOT, "apps/askbible-mobile/assets/content/zh-CN.json"), "utf8"));
// 手机版精简文案（短句 / 要点 / 图标名），见 data/bible-reading-plans/mobile-brief.zh-CN.json
const brief = JSON.parse(readFileSync(path.join(ROOT, "data/bible-reading-plans/mobile-brief.zh-CN.json"), "utf8"));
const flat = {};
(function walk(o, p) { for (const [k, v] of Object.entries(o)) { const key = p ? `${p}.${k}` : k; if (v && typeof v === "object") walk(v, key); else flat[key] = String(v); } })(zh, "");

// 与 triple-loop-plan.ts / nt-deep-repeat-plan.ts 的 registry entry 同
const NATIVE = [
  { planId: "triple-loop", name: "轻松循环读经计划", abbreviation: "3-track", description: "旧约、新约、智慧书三条独立循环；不按日历补读。", dayCount: 1, maxReadingsPerDay: 3, listPriority: -20 },
  { planId: "nt-deep-repeat", name: "新约深读 · 旧约通读", abbreviation: "nt30", description: "AskBible 方法二 · 有效深读：参考麦克阿瑟研经法，52 阶，7 / 14 / 28 天深度。", dayCount: 1, maxReadingsPerDay: 2, listPriority: -15 },
];
const merged = [...NATIVE, ...registry.plans.filter((p) => p.planId !== "triple-loop" && p.planId !== "nt-deep-repeat")];
// sortPlans：过滤 listHidden，按 listPriority（默认 100）再 planId
const plans = merged.filter((p) => !p.listHidden).sort((a, b) => {
  const pa = typeof a.listPriority === "number" ? a.listPriority : 100;
  const pb = typeof b.listPriority === "number" ? b.listPriority : 100;
  return pa !== pb ? pa - pb : a.planId.localeCompare(b.planId);
}).map((p) => ({
  planId: p.planId, name: p.name, description: (p.description || "").replace(/<[^>]+>/g, "").trim(),
  title: flat[`pages.read.plansCatalog.${p.planId}.title`] || p.name,
  subtitle: flat[`pages.read.plansCatalog.${p.planId}.subtitle`] || "",
  blurb: flat[`pages.read.plansCatalog.${p.planId}.blurb`] || "",
  dayCount: p.dayCount, maxReadingsPerDay: p.maxReadingsPerDay,
  listPriority: typeof p.listPriority === "number" ? p.listPriority : 100,
})).map((p) => {
  const b = brief.plans[p.planId];
  if (b) return { ...p, badge: b.badge, tagline: b.tagline, facts: b.facts, how: b.how, detail: b.detail };
  // 经典日课表：一句话 = blurb 的第一个分句；要点 = 天数 / 单日段数；长版 = 整段 blurb
  const first = p.blurb.split(/[。；]/)[0].trim();
  return {
    ...p, badge: brief.classic.badge, tagline: first || p.subtitle,
    facts: [["calendar", `${p.dayCount} 天`], ["today", `每日 ≤ ${p.maxReadingsPerDay} 段`]],
    how: brief.classic.how, detail: p.blurb,
  };
});

// 文案：只取读经计划相关的键
const COPY_PREFIXES = ["pages.read.plans", "pages.read.tripleLoop", "pages.read.ntDeepRepeat", "pages.read.todayPlan", "pages.read.planActivate", "pages.read.planAnchor", "pages.read.planDetail", "pages.read.planPlay", "pages.read.title"];
const copy = Object.fromEntries(Object.keys(flat).filter((k) => COPY_PREFIXES.some((p) => k.startsWith(p)) && !k.startsWith("pages.read.plansCatalog.")).sort().map((k) => [k, flat[k]]));
for (const [k, v] of Object.entries(brief.ui)) copy[`mobile.${k}`] = String(v);

const esc = (s) => JSON.stringify(s);
const header = "// 由 tools/gen-reading-plans.mjs 从 data/bible-reading-plans/registry.json + zh-CN.json + mobile-brief.zh-CN.json 生成，勿手改。\n";
const swift = header + `
/// 计划目录一条。title/subtitle/blurb 是 zh-CN 文案（pages.read.plansCatalog.*），name 是英文表名。
struct ReadingPlanEntry: Identifiable, Hashable {
    let planId: String
    let name: String
    let description: String
    let title: String
    let subtitle: String
    let blurb: String
    let dayCount: Int
    let maxReadingsPerDay: Int
    let listPriority: Int
    /// 手机版精简文案（mobile-brief.zh-CN.json）：徽标 / 一句话 / 要点 chips / 怎么读 / 长版说明
    let badge: String
    let tagline: String
    let facts: [PlanFact]
    let how: [PlanFact]
    let detail: String
    var id: String { planId }
}

/// 图标名 + 短句（图标名 → Material 字形见 PlanIcons）
struct PlanFact: Hashable {
    let icon: String
    let text: String
}

enum ReadingPlanCatalog {
    static let tripleLoopId = "triple-loop"
    static let ntDeepRepeatId = "nt-deep-repeat"
    /// 已按 listPriority / planId 排好（RN sortPlans）
    static let plans: [ReadingPlanEntry] = [
${plans.map((p) => `        ReadingPlanEntry(planId: ${esc(p.planId)}, name: ${esc(p.name)}, description: ${esc(p.description)}, title: ${esc(p.title)}, subtitle: ${esc(p.subtitle)}, blurb: ${esc(p.blurb)}, dayCount: ${p.dayCount}, maxReadingsPerDay: ${p.maxReadingsPerDay}, listPriority: ${p.listPriority},\n            badge: ${esc(p.badge)}, tagline: ${esc(p.tagline)},\n            facts: [${p.facts.map(([i, t]) => `PlanFact(icon: ${esc(i)}, text: ${esc(t)})`).join(", ")}],\n            how: [${p.how.map(([i, t]) => `PlanFact(icon: ${esc(i)}, text: ${esc(t)})`).join(", ")}],\n            detail: ${esc(p.detail)}),`).join("\n")}
    ]
    static func plan(id: String) -> ReadingPlanEntry? { plans.first { $0.planId == id } }
    /// 目录页分组：主推（三循环、新约深读，按此序）与其它
    static var featured: [ReadingPlanEntry] { [tripleLoopId, ntDeepRepeatId].compactMap(plan(id:)) }
    static var others: [ReadingPlanEntry] { plans.filter { $0.planId != tripleLoopId && $0.planId != ntDeepRepeatId } }
    static func isPointerPlan(_ id: String) -> Bool { id == tripleLoopId || id == ntDeepRepeatId }
}

/// 读经计划相关文案（zh-CN.json 的 pages.read.*）。\`f\` 做 {{name}} 占位替换。
enum PlanCopy {
    static let strings: [String: String] = [
${Object.entries(copy).map(([k, v]) => `        ${esc(k)}: ${esc(v)},`).join("\n")}
    ]
    static func t(_ key: String) -> String { strings[key] ?? key }
    static func f(_ key: String, _ args: [String: String]) -> String {
        var s = t(key)
        for (k, v) in args { s = s.replacingOccurrences(of: "{{\\(k)}}", with: v) }
        return s
    }
}
`;
const kotlin = header + `package me.askbible.native_.data

/** 计划目录一条。title/subtitle/blurb 是 zh-CN 文案（pages.read.plansCatalog.*），name 是英文表名。 */
data class ReadingPlanEntry(
    val planId: String,
    val name: String,
    val description: String,
    val title: String,
    val subtitle: String,
    val blurb: String,
    val dayCount: Int,
    val maxReadingsPerDay: Int,
    val listPriority: Int,
    /** 手机版精简文案（mobile-brief.zh-CN.json）：徽标 / 一句话 / 要点 chips / 怎么读 / 长版说明 */
    val badge: String,
    val tagline: String,
    val facts: List<PlanFact>,
    val how: List<PlanFact>,
    val detail: String,
)

/** 图标名 + 短句（图标名 → Material 字形见 ui/PlanWidgets.kt 的 planIconGlyph） */
data class PlanFact(val icon: String, val text: String)

object ReadingPlanCatalog {
    const val TRIPLE_LOOP_ID = "triple-loop"
    const val NT_DEEP_REPEAT_ID = "nt-deep-repeat"
    /** 已按 listPriority / planId 排好（RN sortPlans） */
    val plans: List<ReadingPlanEntry> = listOf(
${plans.map((p) => `        ReadingPlanEntry(${esc(p.planId)}, ${esc(p.name)}, ${esc(p.description)}, ${esc(p.title)}, ${esc(p.subtitle)}, ${esc(p.blurb)}, ${p.dayCount}, ${p.maxReadingsPerDay}, ${p.listPriority},\n            ${esc(p.badge)}, ${esc(p.tagline)},\n            listOf(${p.facts.map(([i, t]) => `PlanFact(${esc(i)}, ${esc(t)})`).join(", ")}),\n            listOf(${p.how.map(([i, t]) => `PlanFact(${esc(i)}, ${esc(t)})`).join(", ")}),\n            ${esc(p.detail)}),`).join("\n")}
    )
    fun plan(id: String): ReadingPlanEntry? = plans.firstOrNull { it.planId == id }
    /** 目录页分组：主推（三循环、新约深读，按此序）与其它 */
    val featured: List<ReadingPlanEntry> get() = listOf(TRIPLE_LOOP_ID, NT_DEEP_REPEAT_ID).mapNotNull { plan(it) }
    val others: List<ReadingPlanEntry> get() = plans.filter { it.planId != TRIPLE_LOOP_ID && it.planId != NT_DEEP_REPEAT_ID }
    fun isPointerPlan(id: String): Boolean = id == TRIPLE_LOOP_ID || id == NT_DEEP_REPEAT_ID
}

/** 读经计划相关文案（zh-CN.json 的 pages.read.*）。f 做 {{name}} 占位替换。 */
object PlanCopy {
    val strings: Map<String, String> = mapOf(
${Object.entries(copy).map(([k, v]) => `        ${esc(k)} to ${esc(v)},`).join("\n")}
    )
    fun t(key: String): String = strings[key] ?? key
    fun f(key: String, args: Map<String, String>): String {
        var s = t(key)
        for ((k, v) in args) s = s.replace("{{" + k + "}}", v)
        return s
    }
}
`.replace("strings[key] ?? key", "strings[key] ?: key");
writeFileSync(path.join(ROOT, "apps/askbible-ios/AskBible/Model/ReadingPlanCatalog.swift"), swift);
writeFileSync(path.join(ROOT, "apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data/ReadingPlanCatalog.kt"), kotlin);

// 日课表 JSON 原样进包（两端在运行时按 planId + dayIndex 取当日）
const builtDir = path.join(ROOT, "data/bible-reading-plans/built");
const iosDir = path.join(ROOT, "apps/askbible-ios/AskBible/Resources/reading-plans");
const andDir = path.join(ROOT, "apps/askbible-android/app/src/main/assets/reading-plans");
mkdirSync(iosDir, { recursive: true }); mkdirSync(andDir, { recursive: true });
let copied = 0;
for (const f of readdirSync(builtDir).filter((x) => x.endsWith(".json"))) {
  copyFileSync(path.join(builtDir, f), path.join(iosDir, f));
  copyFileSync(path.join(builtDir, f), path.join(andDir, f));
  copied++;
}
writeFileSync(path.join(ROOT, "tools/.reading-plans.json"), JSON.stringify({ plans, copyKeys: Object.keys(copy).length }));
console.log(`读经计划目录已生成：${plans.length} 个计划（含 2 个主推），${Object.keys(copy).length} 条文案，${copied} 份日课表已拷进两端包`);
