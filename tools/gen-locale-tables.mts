// 语言展示用的静态表 → 两端（Swift / Kotlin）：
//   · 66 卷繁体书名（RN toZhTwText(简体书名)）
//   · 目录十个分组的 zh / zh-TW / en 标题（scripture_canon_catalog.json + en.json canonSections）
//   · 目录页「圣经 / 旧约 / 新约」三语
//   · 简→繁转换表（RN site-copy-zh-tw-{char-map,phrases,post-fixups}.ts），原生的 ZhTw.convert 与 RN toZhTwText 同算法
//   node node_modules/tsx/dist/cli.mjs tools/gen-locale-tables.mts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as charNs from "../apps/askbible-mobile/src/i18n/site-copy-zh-tw-char-map";
import * as phraseNs from "../apps/askbible-mobile/src/i18n/site-copy-zh-tw-phrases";
import * as fixNs from "../apps/askbible-mobile/src/i18n/site-copy-zh-tw-post-fixups";
import * as booksNs from "../lib/bible/scripture-books";

const unwrap = (ns: any) => (ns?.default && typeof ns.default === "object" && Object.keys(ns).length <= 2 ? ns.default : ns);
const CHAR_MAP: Record<string, string> = unwrap(charNs).ZH_TW_CHAR_MAP;
const PHRASES: ReadonlyArray<readonly [string, string]> = unwrap(phraseNs).ZH_TW_PHRASE_REPLACEMENTS;
const FIXUPS: ReadonlyArray<readonly [string, string]> = unwrap(fixNs).ZH_TW_POST_CHAR_MAP_FIXUPS;
const books: Array<{ bookId: string; bookName: string }> = unwrap(booksNs).scriptureBooks;

/** 与 RN i18n/site-copy.ts 的 toZhTwText 同算法：词组 → 逐字 → 修正 */
export function toZhTw(input: string): string {
  let out = input;
  for (const [from, to] of PHRASES) out = out.replaceAll(from, to);
  out = Array.from(out, (ch) => CHAR_MAP[ch] ?? ch).join("");
  for (const [from, to] of FIXUPS) out = out.replaceAll(from, to);
  return out;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canon = JSON.parse(readFileSync(path.join(ROOT, "apps/askbible-mobile/assets/content/scripture_canon_catalog.json"), "utf8"));
const en = JSON.parse(readFileSync(path.join(ROOT, "apps/askbible-mobile/assets/content/en.json"), "utf8"));
const zh = JSON.parse(readFileSync(path.join(ROOT, "apps/askbible-mobile/assets/content/zh-CN.json"), "utf8"));

const sections = canon.sections.map((s: any) => ({
  id: s.sectionId, zh: s.title, zhTw: toZhTw(s.title), en: en.pages.read.canonSections[s.sectionId]?.title ?? s.title,
}));
const chrome = {
  catalogTitle: { zh: zh.pages.read.title, zhTw: toZhTw(zh.pages.read.title), en: en.pages.read.title },
  testamentOld: { zh: zh.pages.read.catalogTestamentOld, zhTw: toZhTw(zh.pages.read.catalogTestamentOld), en: en.pages.read.catalogTestamentOld },
  testamentNew: { zh: zh.pages.read.catalogTestamentNew, zhTw: toZhTw(zh.pages.read.catalogTestamentNew), en: en.pages.read.catalogTestamentNew },
};
const bookZhTw = books.map((b) => [b.bookId, toZhTw(b.bookName)] as const);

const esc = (s: string) => JSON.stringify(s);
const header = "// 由 tools/gen-locale-tables.mts 从 RN 的 zh-TW 转换表 / scripture-books / canon catalog / en.json 生成，勿手改。\n";
const swift = header + `
/// 语言展示静态表：繁体书名、目录分组三语标题、目录页三语标签、简→繁转换表。
enum LocaleTables {
    static let bookNameZhTw: [String: String] = [
${bookZhTw.map(([id, n]) => `        ${esc(id)}: ${esc(n)},`).join("\n")}
    ]
    /// sectionId → (zh, zhTw, en)
    static let sectionTitles: [String: (zh: String, zhTw: String, en: String)] = [
${sections.map((s: any) => `        ${esc(s.id)}: (zh: ${esc(s.zh)}, zhTw: ${esc(s.zhTw)}, en: ${esc(s.en)}),`).join("\n")}
    ]
    static let catalogTitle = (zh: ${esc(chrome.catalogTitle.zh)}, zhTw: ${esc(chrome.catalogTitle.zhTw)}, en: ${esc(chrome.catalogTitle.en)})
    static let testamentOld = (zh: ${esc(chrome.testamentOld.zh)}, zhTw: ${esc(chrome.testamentOld.zhTw)}, en: ${esc(chrome.testamentOld.en)})
    static let testamentNew = (zh: ${esc(chrome.testamentNew.zh)}, zhTw: ${esc(chrome.testamentNew.zhTw)}, en: ${esc(chrome.testamentNew.en)})

    /// RN ZH_TW_PHRASE_REPLACEMENTS（先于逐字）
    static let zhTwPhrases: [(String, String)] = [
${PHRASES.map(([a, b]) => `        (${esc(a)}, ${esc(b)}),`).join("\n")}
    ]
    /// RN ZH_TW_CHAR_MAP
    static let zhTwChars: [Character: String] = [
${Object.entries(CHAR_MAP).map(([a, b]) => `        ${esc(a)}: ${esc(b)},`).join("\n")}
    ]
    /// RN ZH_TW_POST_CHAR_MAP_FIXUPS（逐字之后）
    static let zhTwFixups: [(String, String)] = [
${FIXUPS.map(([a, b]) => `        (${esc(a)}, ${esc(b)}),`).join("\n")}
    ]
}
`;
const kotlin = header + `package me.askbible.native_.data

/** 语言展示静态表：繁体书名、目录分组三语标题、目录页三语标签、简→繁转换表。 */
data class TriText(val zh: String, val zhTw: String, val en: String)

object LocaleTables {
    val bookNameZhTw: Map<String, String> = mapOf(
${bookZhTw.map(([id, n]) => `        ${esc(id)} to ${esc(n)},`).join("\n")}
    )
    /** sectionId → 三语标题 */
    val sectionTitles: Map<String, TriText> = mapOf(
${sections.map((s: any) => `        ${esc(s.id)} to TriText(${esc(s.zh)}, ${esc(s.zhTw)}, ${esc(s.en)}),`).join("\n")}
    )
    val catalogTitle = TriText(${esc(chrome.catalogTitle.zh)}, ${esc(chrome.catalogTitle.zhTw)}, ${esc(chrome.catalogTitle.en)})
    val testamentOld = TriText(${esc(chrome.testamentOld.zh)}, ${esc(chrome.testamentOld.zhTw)}, ${esc(chrome.testamentOld.en)})
    val testamentNew = TriText(${esc(chrome.testamentNew.zh)}, ${esc(chrome.testamentNew.zhTw)}, ${esc(chrome.testamentNew.en)})

    /** RN ZH_TW_PHRASE_REPLACEMENTS（先于逐字） */
    val zhTwPhrases: List<Pair<String, String>> = listOf(
${PHRASES.map(([a, b]) => `        ${esc(a)} to ${esc(b)},`).join("\n")}
    )
    /** RN ZH_TW_CHAR_MAP */
    val zhTwChars: Map<Char, String> = mapOf(
${Object.entries(CHAR_MAP).map(([a, b]) => `        '${a === "'" ? "\\'" : a}' to ${esc(b)},`).join("\n")}
    )
    /** RN ZH_TW_POST_CHAR_MAP_FIXUPS（逐字之后） */
    val zhTwFixups: List<Pair<String, String>> = listOf(
${FIXUPS.map(([a, b]) => `        ${esc(a)} to ${esc(b)},`).join("\n")}
    )
}
`;
writeFileSync(path.join(ROOT, "apps/askbible-ios/AskBible/Model/LocaleTables.swift"), swift);
writeFileSync(path.join(ROOT, "apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data/LocaleTables.kt"), kotlin);
console.log(`语言表已生成：${bookZhTw.length} 卷繁体名，${sections.length} 个分组，字表 ${Object.keys(CHAR_MAP).length}，词组 ${PHRASES.length}，修正 ${FIXUPS.length}`);
