// 译本目录 → 两端静态表。真源就是 RN 生产环境实际用的那份：
//   · apps/askbible-mobile/src/api/fetchBibleTranslationsCatalog.ts 的 OFFLINE_BUNDLED_INDEX
//     （生产基址是 askbible.me，RN 明确不从主站拉目录，所以这张表就是「之前的接口」给到 App 的全部译本）
//   · lib/bible/youversion-chapter-page.ts 的版本号 / 缩写 / 页面语言表（在线译本逐章抓 bible.com 公开页）
//   · lib/bible/mobile-scripture-r2-downloads.ts（KJV 按需从 R2 下载整本 sqlite）
//   · 朗读：RN translationSupportsChapterAudio = cuv* | web-en / kjv / blm-es | esv | YouVersion 已验证集（目前为空）
//   · 选择器排序 sortPickerTranslations、短标签 shortLabel（readBibleTranslationPickerOrderModel / readBibleSettingsPanelConstants）
// 原生只收「拿得到正文」的：内置 4 本、YouVersion 在线（14 中文 + NIV）、KJV（下载）；
// ESV / NLT / NKJV 要带密钥的 API，生产包里 RN 自己也拉不到，先不列。
//   node node_modules/tsx/dist/cli.mjs tools/gen-translation-catalog.mts [--check]
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as charNs from "../apps/askbible-mobile/src/i18n/site-copy-zh-tw-char-map";
import * as phraseNs from "../apps/askbible-mobile/src/i18n/site-copy-zh-tw-phrases";
import * as fixNs from "../apps/askbible-mobile/src/i18n/site-copy-zh-tw-post-fixups";
import * as orderNs from "../apps/askbible-mobile/src/read/readBibleTranslationPickerOrderModel";
import * as r2Ns from "../lib/bible/mobile-scripture-r2-downloads";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unwrap = (ns: any) => (ns?.default && typeof ns.default === "object" && Object.keys(ns).length <= 2 ? ns.default : ns);
const CHAR_MAP: Record<string, string> = unwrap(charNs).ZH_TW_CHAR_MAP;
const PHRASES: ReadonlyArray<readonly [string, string]> = unwrap(phraseNs).ZH_TW_PHRASE_REPLACEMENTS;
const FIXUPS: ReadonlyArray<readonly [string, string]> = unwrap(fixNs).ZH_TW_POST_CHAR_MAP_FIXUPS;
const sortPickerTranslations = unwrap(orderNs).sortPickerTranslations;
const r2Url = unwrap(r2Ns).mobileScriptureR2DownloadUrl;
function toZhTw(input: string): string {
  let out = input;
  for (const [from, to] of PHRASES) out = out.replaceAll(from, to);
  out = Array.from(out, (ch) => CHAR_MAP[ch] ?? ch).join("");
  for (const [from, to] of FIXUPS) out = out.replaceAll(from, to);
  return out;
}

// RN 目录模块顶层拉了 AsyncStorage 等，去 import 拼桩后加载，取 bundledBibleTranslationsCatalog()
const dir = mkdtempSync(path.join(tmpdir(), "translation-catalog-"));
function pureModule(rel: string, header: string): string {
  const stripped = readFileSync(path.join(ROOT, rel), "utf8")
    .replace(/^import[\s\S]*?from\s+"[^"]+";\s*$/gm, "")
    .replace(/^export \{[^}]*\} from "[^"]+";\s*$/gm, "");
  const out = path.join(dir, path.basename(rel).replace(/\.ts$/, ".mts"));
  writeFileSync(out, header + "\n" + stripped);
  return out;
}
const catalogMod = pureModule("apps/askbible-mobile/src/api/fetchBibleTranslationsCatalog.ts",
  `const AsyncStorage: any = { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };\n` +
  `const getAskBibleBaseUrl = () => "https://askbible.me"; const toAbsoluteUrl = (_b: string, s: string) => s; const isMobileBundledOnly = () => true;\n` +
  `const fetchWithTimeout = async () => { throw new Error("no network in generator"); };\n` +
  `const BUNDLED_SCRIPTURE_TRANSLATION_IDS = ["cuv-simp", "cuv-trad", "web-en", "ust-en"];\ntype BibleTranslationMeta = any; type BibleTranslationsIndex = any;`);
const constantsMod = pureModule("apps/askbible-mobile/src/read/readBibleSettingsPanelConstants.ts",
  `const toZhTwText = ${toZhTw.toString().replace(/^function toZhTw/, "function")};\n` +
  `const PHRASES: any = ${JSON.stringify(PHRASES)}; const CHAR_MAP: any = ${JSON.stringify(CHAR_MAP)}; const FIXUPS: any = ${JSON.stringify(FIXUPS)};`);
const catalog: any = unwrap(await import(catalogMod));
const constants: any = unwrap(await import(constantsMod));
const index = catalog.bundledBibleTranslationsCatalog();

// YouVersion 文字页表（未导出，按源码抽）
const yv = readFileSync(path.join(ROOT, "lib/bible/youversion-chapter-page.ts"), "utf8");
const versionInfo: Record<string, { versionId: string; abbreviation?: string }> = {};
const infoBlock = yv.slice(yv.indexOf("YOUVERSION_TEXT_PAGE_VERSION_INFO"), yv.indexOf("YOUVERSION_PAGE_LOCALES"));
for (const m of infoBlock.matchAll(/"?([\w-]+)"?:\s*\{\s*versionId:\s*"(\d+)"(?:,\s*abbreviation:\s*"([^"]+)")?\s*\}/g)) versionInfo[m[1]] = { versionId: m[2], abbreviation: m[3] };
const pageLocales: Record<string, string> = {};
const localeBlock = yv.slice(yv.indexOf("YOUVERSION_PAGE_LOCALES"), yv.indexOf("const BROWSER_UA"));
for (const m of localeBlock.matchAll(/"([\w-]+)":\s*"([\w-]+)"/g)) pageLocales[m[1]] = m[2];
const browserUa = /const BROWSER_UA =\s*"([^"]+)"/.exec(yv)?.[1] ?? "";
if (!browserUa || Object.keys(versionInfo).length < 10) throw new Error("youversion 表没抽到");

const hasChapterAudio = (id: string) => id.startsWith("cuv") || ["web-en", "kjv", "blm-es"].includes(id) || id === "esv";
type Entry = {
  id: string; labelZh: string; labelEn: string; language: string; delivery: "bundled" | "download" | "online";
  provider: string; remoteId: string; pageLocale: string; abbreviation: string; downloadUrl: string; hasChapterAudio: boolean;
  shortZh: string; shortZhTw: string; shortEn: string;
};
const entries: Entry[] = [];
const skipped: string[] = [];
for (const t of index.translations as any[]) {
  const id = String(t.id);
  let delivery: Entry["delivery"] | null = null;
  const download = r2Url(id);
  if (t.bundled && ["cuv-simp", "cuv-trad", "web-en", "ust-en"].includes(id)) delivery = "bundled";
  else if (download) delivery = "download";
  else if (t.provider === "youversion" && (t.remoteId || versionInfo[id])) delivery = "online";
  if (!delivery) { skipped.push(id); continue; }
  const info = versionInfo[id];
  entries.push({
    id, labelZh: t.labelZh, labelEn: t.labelEn, language: t.language, delivery,
    provider: t.provider ?? (delivery === "bundled" ? "local" : ""), remoteId: String(t.remoteId ?? info?.versionId ?? ""),
    pageLocale: pageLocales[id] ?? "", abbreviation: info?.abbreviation ?? "", downloadUrl: download ?? "", hasChapterAudio: hasChapterAudio(id),
    shortZh: constants.shortLabel(id, "zh-CN", t.labelZh), shortZhTw: constants.shortLabel(id, "zh-TW", toZhTw(t.labelZh)), shortEn: constants.shortLabel(id, "en", t.labelEn),
  });
}
const order = {
  "zh-CN": sortPickerTranslations(entries, "zh-CN").map((e: Entry) => e.id),
  "zh-TW": sortPickerTranslations(entries, "zh-TW").map((e: Entry) => e.id),
  en: sortPickerTranslations(entries, "en").map((e: Entry) => e.id),
};

const esc = (s: string) => JSON.stringify(s);
const header = "// 由 tools/gen-translation-catalog.mts 从 RN 的译本目录 / YouVersion 表 / R2 下载表 / 选择器排序生成，勿手改。\n";
const swift = header + `
/// 译本目录（RN 生产环境 OFFLINE_BUNDLED_INDEX 里拿得到正文的那些）。
enum TranslationCatalog {
    static let entries: [ScriptureTranslation] = [
${entries.map((e) => `        ScriptureTranslation(id: ${esc(e.id)}, labelZh: ${esc(e.labelZh)}, labelEn: ${esc(e.labelEn)}, language: ${esc(e.language)}, delivery: .${e.delivery},\n            provider: ${esc(e.provider)}, remoteId: ${esc(e.remoteId)}, pageLocale: ${esc(e.pageLocale)}, abbreviation: ${esc(e.abbreviation)}, downloadUrl: ${esc(e.downloadUrl)},\n            hasChapterAudio: ${e.hasChapterAudio}, shortZh: ${esc(e.shortZh)}, shortZhTw: ${esc(e.shortZhTw)}, shortEn: ${esc(e.shortEn)}),`).join("\n")}
    ]
    /// 选择器顺序（RN sortPickerTranslations，按界面语言）
    static let pickerOrder: [String: [String]] = [
${Object.entries(order).map(([k, v]) => `        ${esc(k)}: [${v.map(esc).join(", ")}],`).join("\n")}
    ]
    /// 抓 bible.com 页面第二次尝试用的浏览器 UA（RN BROWSER_UA）
    static let browserUserAgent = ${esc(browserUa)}
    /// 生产包里 RN 自己也拿不到正文的译本，没列进来
    static let notListed: [String] = [${skipped.map(esc).join(", ")}]
}
`;
const kotlin = header + `package me.askbible.native_.data

/** 译本目录（RN 生产环境 OFFLINE_BUNDLED_INDEX 里拿得到正文的那些）。 */
object TranslationCatalog {
    val entries: List<ScriptureTranslation> = listOf(
${entries.map((e) => `        ScriptureTranslation(${esc(e.id)}, ${esc(e.labelZh)}, ${esc(e.labelEn)}, ${esc(e.language)}, TranslationDelivery.${e.delivery.toUpperCase()},\n            ${esc(e.provider)}, ${esc(e.remoteId)}, ${esc(e.pageLocale)}, ${esc(e.abbreviation)}, ${esc(e.downloadUrl)},\n            ${e.hasChapterAudio}, ${esc(e.shortZh)}, ${esc(e.shortZhTw)}, ${esc(e.shortEn)}),`).join("\n")}
    )
    /** 选择器顺序（RN sortPickerTranslations，按界面语言） */
    val pickerOrder: Map<String, List<String>> = mapOf(
${Object.entries(order).map(([k, v]) => `        ${esc(k)} to listOf(${v.map(esc).join(", ")}),`).join("\n")}
    )
    /** 抓 bible.com 页面第二次尝试用的浏览器 UA（RN BROWSER_UA） */
    const val BROWSER_USER_AGENT = ${esc(browserUa)}
    /** 生产包里 RN 自己也拿不到正文的译本，没列进来 */
    val notListed: List<String> = listOf(${skipped.map(esc).join(", ")})
}
`;
const targets: Array<[string, string]> = [
  [path.join(ROOT, "apps/askbible-ios/AskBible/Model/TranslationCatalog.swift"), swift],
  [path.join(ROOT, "apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data/TranslationCatalog.kt"), kotlin],
];
if (process.argv.includes("--check")) {
  const stale = targets.filter(([file, content]) => { try { return readFileSync(file, "utf8") !== content; } catch { return true; } });
  if (stale.length) { console.error("译本目录表过期，请跑 npm run gen:translation-catalog：\n  " + stale.map(([f]) => path.relative(ROOT, f)).join("\n  ")); process.exit(1); }
  console.log(`译本目录对拍通过：${entries.length} 个译本（内置 ${entries.filter((e) => e.delivery === "bundled").length} · 下载 ${entries.filter((e) => e.delivery === "download").length} · 在线 ${entries.filter((e) => e.delivery === "online").length}），有朗读 ${entries.filter((e) => e.hasChapterAudio).length}；未列 ${skipped.join(",")}`);
} else {
  for (const [file, content] of targets) writeFileSync(file, content);
  console.log(`译本目录已生成：${entries.length} 个译本（内置 ${entries.filter((e) => e.delivery === "bundled").length} · 下载 ${entries.filter((e) => e.delivery === "download").length} · 在线 ${entries.filter((e) => e.delivery === "online").length}），有朗读 ${entries.filter((e) => e.hasChapterAudio).length}；未列：${skipped.join(",")}`);
}
