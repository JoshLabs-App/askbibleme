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
const briefEn = JSON.parse(readFileSync(path.join(ROOT, "data/bible-reading-plans/mobile-brief.en.json"), "utf8"));
const en = JSON.parse(readFileSync(path.join(ROOT, "apps/askbible-mobile/assets/content/en.json"), "utf8"));
const flat = {}; const flatEn = {};
(function walk(o, p, out) { for (const [k, v] of Object.entries(o)) { const key = p ? `${p}.${k}` : k; if (v && typeof v === "object") walk(v, key, out); else out[key] = String(v); } })(zh, "", flat);
(function walk(o, p, out) { for (const [k, v] of Object.entries(o)) { const key = p ? `${p}.${k}` : k; if (v && typeof v === "object") walk(v, key, out); else out[key] = String(v); } })(en, "", flatEn);

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
  titleEn: flatEn[`pages.read.plansCatalog.${p.planId}.title`] || p.name,
  subtitleEn: flatEn[`pages.read.plansCatalog.${p.planId}.subtitle`] || "",
  blurbEn: flatEn[`pages.read.plansCatalog.${p.planId}.blurb`] || "",
  dayCount: p.dayCount, maxReadingsPerDay: p.maxReadingsPerDay,
  listPriority: typeof p.listPriority === "number" ? p.listPriority : 100,
})).map((p) => {
  const b = brief.plans[p.planId]; const be = briefEn.plans[p.planId];
  // 每条要点 = [图标, 简体, 英文]
  const zip = (a, b) => a.map(([icon, text], i) => [icon, text, (b[i] || [])[1] || text]);
  if (b) return { ...p, badge: b.badge, badgeEn: be.badge, tagline: b.tagline, taglineEn: be.tagline, facts: zip(b.facts, be.facts), how: zip(b.how, be.how), detail: b.detail, detailEn: be.detail };
  // 经典日课表：一句话 = blurb 的第一个分句；要点 = 天数 / 单日段数；长版 = 整段 blurb
  const first = p.blurb.split(/[。；]/)[0].trim();
  const firstEn = p.blurbEn.split(/[.;]/)[0].trim();
  return {
    ...p, badge: brief.classic.badge, badgeEn: briefEn.classic.badge, tagline: first || p.subtitle, taglineEn: firstEn || p.subtitleEn,
    facts: [["calendar", `${p.dayCount} 天`, `${p.dayCount} days`], ["today", `每日 ≤ ${p.maxReadingsPerDay} 段`, `≤ ${p.maxReadingsPerDay} readings a day`]],
    how: zip(brief.classic.how, briefEn.classic.how), detail: p.blurb, detailEn: p.blurbEn,
  };
});

// 文案：只取读经计划相关的键
const COPY_PREFIXES = ["pages.read.plans", "pages.read.tripleLoop", "pages.read.ntDeepRepeat", "pages.read.todayPlan", "pages.read.planActivate", "pages.read.planAnchor", "pages.read.planDetail", "pages.read.planPlay", "pages.read.title"];
const copy = Object.fromEntries(Object.keys(flat).filter((k) => COPY_PREFIXES.some((p) => k.startsWith(p)) && !k.startsWith("pages.read.plansCatalog.")).sort().map((k) => [k, flat[k]]));
for (const [k, v] of Object.entries(brief.ui)) copy[`mobile.${k}`] = String(v);

const esc = (s) => JSON.stringify(s);
const header = "// 由 tools/gen-reading-plans.mjs 从 data/bible-reading-plans/registry.json + zh-CN.json / en.json + mobile-brief.{zh-CN,en}.json 生成，勿手改。文案见 SiteCopy。\n";
const swift = header + `
/// 计划目录一条。title/subtitle/blurb 与手机版精简文案都是简 / 英两份，按 AppLocale.current 取（繁体运行时转）；name 是英文表名。
struct ReadingPlanEntry: Identifiable, Hashable {
    let planId: String
    let name: String
    let description: String
    let titleZh: String, titleEn: String
    let subtitleZh: String, subtitleEn: String
    let blurbZh: String, blurbEn: String
    let dayCount: Int
    let maxReadingsPerDay: Int
    let listPriority: Int
    /// 手机版精简文案（mobile-brief）：徽标 / 一句话 / 要点 chips / 怎么读 / 长版说明
    let badgeZh: String, badgeEn: String
    let taglineZh: String, taglineEn: String
    let facts: [PlanFact]
    let how: [PlanFact]
    let detailZh: String, detailEn: String
    var id: String { planId }
    var title: String { AppLocale.pick(titleZh, titleEn) }
    var subtitle: String { AppLocale.pick(subtitleZh, subtitleEn) }
    var blurb: String { AppLocale.pick(blurbZh, blurbEn) }
    var badge: String { AppLocale.pick(badgeZh, badgeEn) }
    var tagline: String { AppLocale.pick(taglineZh, taglineEn) }
    var detail: String { AppLocale.pick(detailZh, detailEn) }
}

/// 图标名 + 短句（图标名 → Material 字形见 Read/PlanWidgets.swift 的 PlanIcons.glyph）
struct PlanFact: Hashable {
    let icon: String
    let textZh: String
    let textEn: String
    var text: String { AppLocale.pick(textZh, textEn) }
}

enum ReadingPlanCatalog {
    static let tripleLoopId = "triple-loop"
    static let ntDeepRepeatId = "nt-deep-repeat"
    /// 已按 listPriority / planId 排好（RN sortPlans）
    static let plans: [ReadingPlanEntry] = [
${plans.map((p) => `        ReadingPlanEntry(planId: ${esc(p.planId)}, name: ${esc(p.name)}, description: ${esc(p.description)},\n            titleZh: ${esc(p.title)}, titleEn: ${esc(p.titleEn)}, subtitleZh: ${esc(p.subtitle)}, subtitleEn: ${esc(p.subtitleEn)}, blurbZh: ${esc(p.blurb)}, blurbEn: ${esc(p.blurbEn)},\n            dayCount: ${p.dayCount}, maxReadingsPerDay: ${p.maxReadingsPerDay}, listPriority: ${p.listPriority},\n            badgeZh: ${esc(p.badge)}, badgeEn: ${esc(p.badgeEn)}, taglineZh: ${esc(p.tagline)}, taglineEn: ${esc(p.taglineEn)},\n            facts: [${p.facts.map(([i, t, e]) => `PlanFact(icon: ${esc(i)}, textZh: ${esc(t)}, textEn: ${esc(e)})`).join(", ")}],\n            how: [${p.how.map(([i, t, e]) => `PlanFact(icon: ${esc(i)}, textZh: ${esc(t)}, textEn: ${esc(e)})`).join(", ")}],\n            detailZh: ${esc(p.detail)}, detailEn: ${esc(p.detailEn)}),`).join("\n")}
    ]
    static func plan(id: String) -> ReadingPlanEntry? { plans.first { $0.planId == id } }
    /// 目录页分组：主推（三循环、新约深读，按此序）与其它
    static var featured: [ReadingPlanEntry] { [tripleLoopId, ntDeepRepeatId].compactMap(plan(id:)) }
    static var others: [ReadingPlanEntry] { plans.filter { $0.planId != tripleLoopId && $0.planId != ntDeepRepeatId } }
    static func isPointerPlan(_ id: String) -> Bool { id == tripleLoopId || id == ntDeepRepeatId }
}

`;
const kotlin = header + `package me.askbible.native_.data

/** 计划目录一条。title/subtitle/blurb 与手机版精简文案都是简 / 英两份，按 AppLocale.current 取（繁体运行时转）；name 是英文表名。 */
data class ReadingPlanEntry(
    val planId: String,
    val name: String,
    val description: String,
    val titleZh: String, val titleEn: String,
    val subtitleZh: String, val subtitleEn: String,
    val blurbZh: String, val blurbEn: String,
    val dayCount: Int,
    val maxReadingsPerDay: Int,
    val listPriority: Int,
    /** 手机版精简文案（mobile-brief）：徽标 / 一句话 / 要点 chips / 怎么读 / 长版说明 */
    val badgeZh: String, val badgeEn: String,
    val taglineZh: String, val taglineEn: String,
    val facts: List<PlanFact>,
    val how: List<PlanFact>,
    val detailZh: String, val detailEn: String,
) {
    val title: String get() = AppLocale.pick(titleZh, titleEn)
    val subtitle: String get() = AppLocale.pick(subtitleZh, subtitleEn)
    val blurb: String get() = AppLocale.pick(blurbZh, blurbEn)
    val badge: String get() = AppLocale.pick(badgeZh, badgeEn)
    val tagline: String get() = AppLocale.pick(taglineZh, taglineEn)
    val detail: String get() = AppLocale.pick(detailZh, detailEn)
}

/** 图标名 + 短句（图标名 → Material 字形见 ui/PlanWidgets.kt 的 planIconGlyph） */
data class PlanFact(val icon: String, val textZh: String, val textEn: String) {
    val text: String get() = AppLocale.pick(textZh, textEn)
}

object ReadingPlanCatalog {
    const val TRIPLE_LOOP_ID = "triple-loop"
    const val NT_DEEP_REPEAT_ID = "nt-deep-repeat"
    /** 已按 listPriority / planId 排好（RN sortPlans） */
    val plans: List<ReadingPlanEntry> = listOf(
${plans.map((p) => `        ReadingPlanEntry(${esc(p.planId)}, ${esc(p.name)}, ${esc(p.description)},\n            ${esc(p.title)}, ${esc(p.titleEn)}, ${esc(p.subtitle)}, ${esc(p.subtitleEn)}, ${esc(p.blurb)}, ${esc(p.blurbEn)},\n            ${p.dayCount}, ${p.maxReadingsPerDay}, ${p.listPriority},\n            ${esc(p.badge)}, ${esc(p.badgeEn)}, ${esc(p.tagline)}, ${esc(p.taglineEn)},\n            listOf(${p.facts.map(([i, t, e]) => `PlanFact(${esc(i)}, ${esc(t)}, ${esc(e)})`).join(", ")}),\n            listOf(${p.how.map(([i, t, e]) => `PlanFact(${esc(i)}, ${esc(t)}, ${esc(e)})`).join(", ")}),\n            ${esc(p.detail)}, ${esc(p.detailEn)}),`).join("\n")}
    )
    fun plan(id: String): ReadingPlanEntry? = plans.firstOrNull { it.planId == id }
    /** 目录页分组：主推（三循环、新约深读，按此序）与其它 */
    val featured: List<ReadingPlanEntry> get() = listOf(TRIPLE_LOOP_ID, NT_DEEP_REPEAT_ID).mapNotNull { plan(it) }
    val others: List<ReadingPlanEntry> get() = plans.filter { it.planId != TRIPLE_LOOP_ID && it.planId != NT_DEEP_REPEAT_ID }
    fun isPointerPlan(id: String): Boolean = id == TRIPLE_LOOP_ID || id == NT_DEEP_REPEAT_ID
}

`;
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
