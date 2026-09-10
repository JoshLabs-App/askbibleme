#!/usr/bin/env node
/**
 * 原生两端共用的界面文案表 SiteCopy（简 / 英；繁体运行时由 ZhTw 转）。
 *
 * 真源：apps/askbible-mobile/assets/content/{zh-CN,en}.json（与网站 locales/*.json 同）
 *      + RN src/i18n/site-copy.ts 里的 AUTH_UI_FALLBACKS（JSON 里没有的登录 / 欢迎页文案）
 *      + data/bible-reading-plans/mobile-brief.{zh-CN,en}.json 的 ui（→ mobile.*）
 *      + tools/native-copy-extra.json（原生独有的键 native.*）
 * 键集合：扫两端源码里 SiteCopy / PlanCopy / PlanText 用到的键 + 读经计划文案前缀（与 gen-reading-plans 一致）。
 * 缺英文或缺键直接报错，不让原生界面再混进写死的中文。
 *
 *   node tools/gen-site-copy.mjs          生成
 *   node tools/gen-site-copy.mjs --check  只比对（产物与真源不一致就退出 1）
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const flat = (o, p = "", out = {}) => { for (const [k, v] of Object.entries(o)) { const key = p ? `${p}.${k}` : k; if (v && typeof v === "object") flat(v, key, out); else out[key] = String(v); } return out; };

const zh = flat(JSON.parse(read("apps/askbible-mobile/assets/content/zh-CN.json")));
const en = flat(JSON.parse(read("apps/askbible-mobile/assets/content/en.json")));
// RN site-copy.ts 的 AUTH_UI_FALLBACKS：JSON 里没有时 t() 用它们
for (const m of read("apps/askbible-mobile/src/i18n/site-copy.ts").matchAll(/"([\w.]+)":\s*\{\s*zh:\s*"((?:[^"\\]|\\.)*)",\s*en:\s*"((?:[^"\\]|\\.)*)"/g)) {
  if (!(m[1] in zh)) { zh[m[1]] = JSON.parse(`"${m[2]}"`); en[m[1]] = JSON.parse(`"${m[3]}"`); }
}
const briefZh = JSON.parse(read("data/bible-reading-plans/mobile-brief.zh-CN.json"));
const briefEn = JSON.parse(read("data/bible-reading-plans/mobile-brief.en.json"));
for (const [k, v] of Object.entries(briefZh.ui)) { zh[`mobile.${k}`] = String(v); en[`mobile.${k}`] = String(briefEn.ui[k] ?? ""); }
const extra = JSON.parse(read("tools/native-copy-extra.json"));
for (const [k, v] of Object.entries(extra)) { if (k.startsWith("_")) continue; zh[k] = v.zh; en[k] = v.en; }

// 键集合
const COPY_PREFIXES = ["pages.read.plans", "pages.read.tripleLoop", "pages.read.ntDeepRepeat", "pages.read.todayPlan", "pages.read.planActivate", "pages.read.planAnchor", "pages.read.planDetail", "pages.read.planPlay", "pages.read.title"];
const keys = new Set(Object.keys(zh).filter((k) => (COPY_PREFIXES.some((p) => k.startsWith(p)) && !k.startsWith("pages.read.plansCatalog.")) || k.startsWith("mobile.") || k.startsWith("native.")));
const walk = (dir, exts, out = []) => { for (const f of readdirSync(dir)) { const p = path.join(dir, f); const s = statSync(p); if (s.isDirectory()) { if (f !== "build" && f !== "node_modules") walk(p, exts, out); } else if (exts.some((e) => f.endsWith(e))) out.push(p); } return out; };
const sources = [
  ...walk(path.join(ROOT, "apps/askbible-ios/AskBible"), [".swift"]),
  ...walk(path.join(ROOT, "apps/askbible-android/app/src/main/java"), [".kt"]),
  ...walk(path.join(ROOT, "apps/askbible-android/core/src/main/kotlin"), [".kt"]),
].filter((p) => !/SiteCopy\.(swift|kt)$/.test(p));
const missing = new Map();
for (const p of sources) {
  const src = readFileSync(p, "utf8");
  // 带插值的键（pace\(p) / pace$p）由代码拼，扫不到；它们的所有取值必须已在前缀集合 / extra 里
  const literal = (k) => k && !k.includes("\\(") && !k.includes("$");
  for (const m of src.matchAll(/(?:SiteCopy|PlanCopy)\.[tf]\("([^"]*)"\s*[,)]/g)) if (literal(m[1])) { keys.add(m[1]); if (!(m[1] in zh)) missing.set(m[1], path.relative(ROOT, p)); }
  for (const m of src.matchAll(/PlanText\.[tf]\("([^"]*)"\s*[,)]/g)) if (literal(m[1])) { keys.add(`mobile.${m[1]}`); if (!(`mobile.${m[1]}` in zh)) missing.set(`mobile.${m[1]}`, path.relative(ROOT, p)); }
  // 写成「条件 ? 键A : 键B」再传进 t() 的，直接扫所有长得像文案键的字面量（真源里存在才收）
  for (const m of src.matchAll(/"((?:pages|auth|common|nav|chrome|playback|music|nature|localeNames|localePicker|admin|shellTemplatePage|contentCorrection|onboarding|native|mobile)\.[\w.\-]+)"/g)) {
    if (m[1] in zh) keys.add(m[1]);
  }
}
if (missing.size) { console.error("SiteCopy 缺键：\n" + [...missing].map(([k, f]) => `  ${k}  ← ${f}`).join("\n")); process.exit(1); }
// native-copy-extra 里明确写了 en 的（哪怕是空串，如英文里不需要的「天」后缀）不算缺
const explicitEn = new Set(Object.keys(extra));
const noEn = [...keys].filter((k) => !explicitEn.has(k) && !(en[k] ?? "").trim() && (zh[k] ?? "").trim());
if (noEn.length) { console.error("SiteCopy 缺英文：\n  " + noEn.join("\n  ")); process.exit(1); }
const sorted = [...keys].sort();
const esc = (s) => JSON.stringify(s);
const header = "// 由 tools/gen-site-copy.mjs 从 zh-CN.json / en.json / site-copy.ts 回退 / mobile-brief / native-copy-extra 生成，勿手改。\n";

const swift = header + `import Foundation

/// 原生两端共用的界面文案：简体真源 + 英文；繁体面运行时 ZhTw 转。\`f\` 做 {{name}} 占位替换。
/// 不传 locale 用 AppLocale.current（壳在语言变化时更新）。
enum SiteCopy {
    static let strings: [String: (zh: String, en: String)] = [
${sorted.map((k) => `        ${esc(k)}: (${esc(zh[k])}, ${esc(en[k])}),`).join("\n")}
    ]

    static func t(_ key: String, _ locale: AppLocale = AppLocale.current) -> String {
        guard let s = strings[key] else { return key }
        return locale == .en ? s.en : locale.zh(s.zh)
    }

    static func f(_ key: String, _ args: [String: String], _ locale: AppLocale = AppLocale.current) -> String {
        var s = t(key, locale)
        for (k, v) in args { s = s.replacingOccurrences(of: "{{\\(k)}}", with: v) }
        return s
    }

    /// 模型层产出的简体文案（登录 / 同步错误等，对拍规则要求它们保持简体）→ 按当前语言换成对应文案；不认识的原样返回
    static func localizeKnown(_ text: String, _ locale: AppLocale = AppLocale.current) -> String {
        let key = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let hit = strings.first(where: { $0.value.zh == key }) else { return locale.zh(text) }
        return t(hit.key, locale)
    }
}

/// 旧名：读经计划文案（pages.read.*）也在 SiteCopy 里
typealias PlanCopy = SiteCopy
`;

const kotlin = header + `package me.askbible.native_.data

/**
 * 原生两端共用的界面文案：简体真源 + 英文；繁体面运行时 ZhTw 转。f 做 {{name}} 占位替换。
 * 不传 locale 用 AppLocale.current（壳在语言变化时更新）。
 */
object SiteCopy {
    val strings: Map<String, Pair<String, String>> = mapOf(
${sorted.map((k) => `        ${esc(k)} to Pair(${esc(zh[k])}, ${esc(en[k])}),`).join("\n")}
    )

    fun t(key: String, locale: AppLocale = AppLocale.current): String {
        val s = strings[key] ?: return key
        return if (locale == AppLocale.EN) s.second else locale.zh(s.first)
    }

    fun f(key: String, args: Map<String, String>, locale: AppLocale = AppLocale.current): String {
        var s = t(key, locale)
        for ((k, v) in args) s = s.replace("{{" + k + "}}", v)
        return s
    }

    /** 模型层产出的简体文案（登录 / 同步错误等，对拍规则要求它们保持简体）→ 按当前语言换成对应文案；不认识的原样返回 */
    fun localizeKnown(text: String, locale: AppLocale = AppLocale.current): String {
        val key = text.trim()
        val hit = strings.entries.firstOrNull { it.value.first == key } ?: return locale.zh(text)
        return t(hit.key, locale)
    }
}

/** 旧名：读经计划文案（pages.read.*）也在 SiteCopy 里 */
typealias PlanCopy = SiteCopy
`;
const outSwift = path.join(ROOT, "apps/askbible-ios/AskBible/Model/SiteCopy.swift");
const outKt = path.join(ROOT, "apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data/SiteCopy.kt");
if (CHECK) {
  const cur = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };
  if (cur(outSwift) !== swift || cur(outKt) !== kotlin) { console.error("SiteCopy 与真源不一致，跑 npm run gen:site-copy"); process.exit(1); }
  console.log(`SiteCopy 自检通过：${sorted.length} 条文案（简 / 英），两端与真源一致`);
} else {
  writeFileSync(outSwift, swift); writeFileSync(outKt, kotlin);
  console.log(`SiteCopy 已生成：${sorted.length} 条文案（简 / 英），两端`);
}
