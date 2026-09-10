#!/usr/bin/env node
/**
 * 译本面板语言行的排序表 → 两端静态表。
 *
 * 真源：data/language-speakers.json（各语言使用人数，粗略公开数据）。
 * 之前语言行按「我们手上有几个版本」排，梵语 22 个版本会排在最前面 —— 改成按使用人数排（Josh 2026-09-10）。
 *
 *   node tools/gen-language-order.mjs          生成
 *   node tools/gen-language-order.mjs --check  只比对
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const src = JSON.parse(readFileSync(path.join(ROOT, "data/language-speakers.json"), "utf8"));
// 人数从多到少；同数按语言码，保证两端顺序完全一致
const ordered = Object.entries(src.languages).sort((a, b) => (b[1].speakers - a[1].speakers) || a[0].localeCompare(b[0]));
const header = "// 由 tools/gen-language-order.mjs 从 data/language-speakers.json 生成，勿手改。\n";

const swift = header + `
/// 译本面板语言行的排序与名字：使用人数多的语言排前面（表里没有的排在后面，再按版本数）；
/// 名字自带中英两份 —— 目录接口老版本只给中文名，英文界面不该显示中文语言名。
enum LanguageOrder {
    /// 语言码 → (名次（0 最靠前）, 中文名, 英文名)
    static let table: [String: (rank: Int, zh: String, en: String)] = [
${ordered.map(([tag, v], i) => `        ${JSON.stringify(tag)}: (${i}, ${JSON.stringify(v.zh)}, ${JSON.stringify(v.en)}),`).join("\n")}
    ]

    private static func key(_ tag: String) -> String { tag.trimmingCharacters(in: .whitespaces).lowercased() }

    /// 表里没有的排在所有登记语言之后
    static func rank(_ tag: String) -> Int { table[key(tag)]?.rank ?? Int.max }

    /// 内置的语言名（按界面语言）；表里没有返回 nil
    static func name(_ tag: String, _ locale: AppLocale) -> String? {
        guard let hit = table[key(tag)] else { return nil }
        return locale == .en ? hit.en : locale.zh(hit.zh)
    }
}
`;

const kotlin = header + `package me.askbible.native_.data

/**
 * 译本面板语言行的排序与名字：使用人数多的语言排前面（表里没有的排在后面，再按版本数）；
 * 名字自带中英两份 —— 目录接口老版本只给中文名，英文界面不该显示中文语言名。
 */
object LanguageOrder {
    data class Entry(val rank: Int, val zh: String, val en: String)

    /** 语言码 → 名次（0 最靠前）+ 中英名字 */
    val table: Map<String, Entry> = mapOf(
${ordered.map(([tag, v], i) => `        ${JSON.stringify(tag)} to Entry(${i}, ${JSON.stringify(v.zh)}, ${JSON.stringify(v.en)}),`).join("\n")}
    )

    /** 表里没有的排在所有登记语言之后 */
    fun rank(tag: String): Int = table[tag.trim().lowercase()]?.rank ?: Int.MAX_VALUE

    /** 内置的语言名（按界面语言）；表里没有返回 null */
    fun name(tag: String, locale: AppLocale): String? {
        val hit = table[tag.trim().lowercase()] ?: return null
        return if (locale == AppLocale.EN) hit.en else locale.zh(hit.zh)
    }
}
`;

const outSwift = path.join(ROOT, "apps/askbible-ios/AskBible/Model/LanguageOrder.swift");
const outKt = path.join(ROOT, "apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data/LanguageOrder.kt");
if (CHECK) {
  const cur = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };
  if (cur(outSwift) !== swift || cur(outKt) !== kotlin) { console.error("LanguageOrder 与真源不一致，跑 npm run gen:language-order"); process.exit(1); }
  console.log(`语言排序自检通过：${ordered.length} 种语言，两端与真源一致`);
} else {
  writeFileSync(outSwift, swift); writeFileSync(outKt, kotlin);
  console.log(`语言排序已生成：${ordered.length} 种语言，两端`);
}
