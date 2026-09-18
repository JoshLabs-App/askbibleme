#!/usr/bin/env node
/**
 * 成就系统的勋章 / 等级 / XP 表（DECISIONS「成就系统：复用 MY CLASS 勋章图」「XP 要一直在涨」）。
 *
 * 真源：data/medals.json（网页端直接 import 这个 JSON，不经生成）
 * 产物：iOS MedalCatalog.swift / 安卓 MedalCatalog.kt —— 只是表，判定逻辑各端自己写（有 check:medals 对拍）
 *
 *   node tools/gen-medals.mjs          生成
 *   node tools/gen-medals.mjs --check  只比对（产物与真源不一致就退出 1）
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const SRC = JSON.parse(readFileSync(path.join(ROOT, "data/medals.json"), "utf8"));
const esc = (s) => JSON.stringify(s);
const dbl = (n) => (Number.isInteger(n) ? `${n}.0` : String(n));
const header = "// 由 tools/gen-medals.mjs 从 data/medals.json 生成，勿手改。\n";

const { medals, levels, xp, seals, imageBase } = SRC;
for (const m of medals) {
  if (!m.key || !m.metric || !Array.isArray(m.tiers) || !m.tiers.length) throw new Error(`勋章定义不全：${m.key}`);
  if (!m.name?.zh || !m.name?.en || !m.condition?.zh || !m.condition?.en) throw new Error(`勋章缺文案：${m.key}`);
  if (m.tiers.some((t, i) => i && t <= m.tiers[i - 1])) throw new Error(`勋章档位未递增：${m.key}`);
}
if (seals.files.length !== 66) throw new Error("印章必须 66 卷");
if (levels.thresholds.length !== levels.titles.length) throw new Error("等级门槛与称号数量不符");

const unit = (m, f) => m.unit ? esc(m.unit[f]) : esc("");
const sw = (m) => `        MedalDef(${esc(m.key)}, ${esc(m.category)}, .${m.metric}, [${m.tiers.join(", ")}], ` +
  `(${esc(m.name.zh)}, ${esc(m.name.en)}), (${esc(m.condition.zh)}, ${esc(m.condition.en)}), (${unit(m, "zh")}, ${unit(m, "en")})),`;
const kt = (m) => `        MedalDef(${esc(m.key)}, ${esc(m.category)}, MedalMetric.${m.metric.replace(/([A-Z])/g, "_$1").toUpperCase()}, listOf(${m.tiers.join(", ")}), ` +
  `${esc(m.name.zh)} to ${esc(m.name.en)}, ${esc(m.condition.zh)} to ${esc(m.condition.en)}, ${unit(m, "zh")} to ${unit(m, "en")}),`;

const metrics = [...new Set(medals.map((m) => m.metric))].sort();
const swiftMetrics = metrics.map((m) => `    case ${m}`).join("\n");
const kotlinMetrics = metrics.map((m) => `    ${m.replace(/([A-Z])/g, "_$1").toUpperCase()}`).join(",\n");

const xpSwift = `    /// 微反馈：读一节 / 每 ${xp.listenTickSeconds} 秒听读，都会让 XP 跳一次
    static let perVerseRead = ${xp.perVerseRead}
    static let perListenTick = ${xp.perListenTick}
    static let listenTickSeconds: Double = ${dbl(xp.listenTickSeconds)}
    /// 同一章最多给几片听读 XP（防挂机刷分：${xp.listenTicksPerChapterCap} 片 ≈ ${Math.round(xp.listenTicksPerChapterCap * xp.listenTickSeconds / 60)} 分钟）
    static let listenTicksPerChapterCap = ${xp.listenTicksPerChapterCap}
    /// 里程碑
    static let perChapterRead = ${xp.perChapterRead}
    static let perBookCompleted = ${xp.perBookCompleted}
    static let perReadingDay = ${xp.perReadingDay}
    static let firstOpenOfDay = ${xp.firstOpenOfDay}
    static let perFavorite = ${xp.perFavorite}
    static let perHighlight = ${xp.perHighlight}
    static let perNote = ${xp.perNote}
    static let perPlanDay = ${xp.perPlanDay}
    static let perMedalTier = ${xp.perMedalTier}
    static let perSeal = ${xp.perSeal}
    /// 连续天数乘区：1 + 天数 × perDay，封顶 cap。取「当前连续天数」与「历史最长」的较大者——只升不降
    static let streakPerDay = ${dbl(xp.streakMultiplier.perDay)}
    static let streakCap = ${dbl(xp.streakMultiplier.cap)}
    /// 连读同卷：第 2 章起每章额外 +step，封顶 cap
    static let comboStep = ${xp.combo.step}
    static let comboCap = ${xp.combo.cap}`;

const xpKotlin = xpSwift
  .replace(/static let (\w+)(: Double)? = ([\d.]+)/g, (_, n, _t, v) => `const val ${n}${v.includes(".") ? ": Double" : ""} = ${v}`)
  .replace(/\/\/\//g, "//");

const swift = header + `import Foundation

/// 勋章判定用到的统计口径
enum MedalMetric: String, Codable {
${swiftMetrics}
}

/// 一枚勋章：一张图 + 若干递增档位，App 里靠档位叠色区分铜 / 银 / 金
struct MedalDef: Identifiable {
    let key: String
    let category: String
    let metric: MedalMetric
    let tiers: [Int]
    let name: (zh: String, en: String)
    let condition: (zh: String, en: String)
    let unit: (zh: String, en: String)
    var id: String { key }

    init(_ key: String, _ category: String, _ metric: MedalMetric, _ tiers: [Int],
         _ name: (String, String), _ condition: (String, String), _ unit: (String, String)) {
        self.key = key; self.category = category; self.metric = metric; self.tiers = tiers
        self.name = name; self.condition = condition; self.unit = unit
    }

    func localizedName(_ l: AppLocale = AppLocale.current) -> String { l == .en ? name.en : l.zh(name.zh) }
    func localizedUnit(_ l: AppLocale = AppLocale.current) -> String { l == .en ? unit.en : l.zh(unit.zh) }
    /// {n} 换成该档门槛
    func localizedCondition(tier: Int, _ l: AppLocale = AppLocale.current) -> String {
        let raw = l == .en ? condition.en : l.zh(condition.zh)
        let n = tiers[min(max(tier, 1), tiers.count) - 1]
        return raw.replacingOccurrences(of: "{n}", with: "\\(n)")
    }
}

enum MedalCatalog {
    static let version = ${SRC.version}
    static let imageBase = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/" + ${esc(imageBase)}
    static func imageURL(_ key: String) -> URL? { URL(string: imageBase + key + ".webp") }

    static let all: [MedalDef] = [
${medals.map(sw).join("\n")}
    ]
    static func def(_ key: String) -> MedalDef? { all.first { $0.key == key } }

    /// 66 卷书卷印章，顺序同圣经正典
    static let seals: [String] = [
${seals.files.map((f) => `        ${esc(f)},`).join("\n")}
    ]
}

enum MedalXP {
${xpSwift}
}

enum MedalLevels {
    static let thresholds: [Int] = [${levels.thresholds.join(", ")}]
    static let step = ${levels.step}
    static let titles: [(zh: String, en: String)] = [
${levels.titles.map((t) => `        (${esc(t.zh)}, ${esc(t.en)}),`).join("\n")}
    ]

    /// 当前等级（从 1 起）
    static func level(xp: Int) -> Int {
        if let i = thresholds.lastIndex(where: { xp >= $0 }), i < thresholds.count - 1 { return i + 1 }
        return thresholds.count + max(0, (xp - (thresholds.last ?? 0)) / step)
    }
    /// 该等级的 XP 下限
    static func floor(_ level: Int) -> Int {
        level <= thresholds.count ? thresholds[max(level, 1) - 1] : (thresholds.last ?? 0) + (level - thresholds.count) * step
    }
    /// 升到下一级需要的 XP 总数
    static func ceiling(_ level: Int) -> Int { floor(level + 1) }
    static func title(_ level: Int, _ l: AppLocale = AppLocale.current) -> String {
        let t = titles[min(max(level, 1), titles.count) - 1]
        return l == .en ? t.en : l.zh(t.zh)
    }
}
`;

const kotlin = header + `package me.askbible.native_.data

/** 勋章判定用到的统计口径 */
enum class MedalMetric {
${kotlinMetrics}
}

/** 一枚勋章：一张图 + 若干递增档位，App 里靠档位叠色区分铜 / 银 / 金 */
data class MedalDef(
    val key: String,
    val category: String,
    val metric: MedalMetric,
    val tiers: List<Int>,
    val name: Pair<String, String>,
    val condition: Pair<String, String>,
    val unit: Pair<String, String>,
) {
    fun localizedName(l: AppLocale = AppLocale.current): String = if (l == AppLocale.EN) name.second else l.zh(name.first)
    fun localizedUnit(l: AppLocale = AppLocale.current): String = if (l == AppLocale.EN) unit.second else l.zh(unit.first)

    /** {n} 换成该档门槛 */
    fun localizedCondition(tier: Int, l: AppLocale = AppLocale.current): String {
        val raw = if (l == AppLocale.EN) condition.second else l.zh(condition.first)
        val n = tiers[tier.coerceIn(1, tiers.size) - 1]
        return raw.replace("{n}", n.toString())
    }
}

object MedalCatalog {
    const val VERSION = ${SRC.version}
    const val IMAGE_BASE = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/" + ${esc(imageBase)}
    fun imageUrl(key: String): String = IMAGE_BASE + key + ".webp"

    val all: List<MedalDef> = listOf(
${medals.map(kt).join("\n")}
    )
    fun def(key: String): MedalDef? = all.firstOrNull { it.key == key }

    /** 66 卷书卷印章，顺序同圣经正典 */
    val seals: List<String> = listOf(
${seals.files.map((f) => `        ${esc(f)},`).join("\n")}
    )
}

object MedalXP {
${xpKotlin}
}

object MedalLevels {
    val thresholds: List<Int> = listOf(${levels.thresholds.join(", ")})
    const val STEP = ${levels.step}
    val titles: List<Pair<String, String>> = listOf(
${levels.titles.map((t) => `        ${esc(t.zh)} to ${esc(t.en)},`).join("\n")}
    )

    /** 当前等级（从 1 起） */
    fun level(xp: Int): Int {
        val i = thresholds.indexOfLast { xp >= it }
        if (i in 0 until thresholds.size - 1) return i + 1
        return thresholds.size + maxOf(0, (xp - thresholds.last()) / STEP)
    }

    /** 该等级的 XP 下限 */
    fun floor(level: Int): Int =
        if (level <= thresholds.size) thresholds[maxOf(level, 1) - 1]
        else thresholds.last() + (level - thresholds.size) * STEP

    /** 升到下一级需要的 XP 总数 */
    fun ceiling(level: Int): Int = floor(level + 1)

    fun title(level: Int, l: AppLocale = AppLocale.current): String {
        val t = titles[level.coerceIn(1, titles.size) - 1]
        return if (l == AppLocale.EN) t.second else l.zh(t.first)
    }
}
`;

const targets = [
  ["apps/askbible-ios/AskBible/Model/MedalCatalog.swift", swift],
  ["apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data/MedalCatalog.kt", kotlin],
];
let bad = 0;
for (const [rel, body] of targets) {
  const abs = path.join(ROOT, rel);
  if (CHECK) {
    let cur = "";
    try { cur = readFileSync(abs, "utf8"); } catch { cur = ""; }
    if (cur !== body) { console.error(`成就表与真源不一致：${rel}（跑 npm run gen:medals）`); bad++; }
  } else writeFileSync(abs, body);
}
if (CHECK) { if (bad) process.exit(1); console.log(`成就表一致：${medals.length} 枚勋章 / ${medals.reduce((a, m) => a + m.tiers.length, 0)} 档 / ${seals.files.length} 卷印章`); }
else console.log(`已生成 ${targets.length} 份：${medals.length} 枚勋章 / ${medals.reduce((a, m) => a + m.tiers.length, 0)} 档 / ${seals.files.length} 卷印章 / ${levels.titles.length} 级称号`);
