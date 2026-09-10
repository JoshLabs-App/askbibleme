/**
 * 语言展示规则的 TS 期望值。`i18n/config.ts` 顶层拉了 react-native，`site-copy.ts` 拉了 locale-store，
 * 都按本仓库惯例去掉 import 行、拼上桩再加载；转换表三个文件是纯模块，直接 import。
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(path.join(tmpdir(), "locale-ts-"));
function pureModule(rel: string, header: string): string {
  const stripped = readFileSync(path.join(ROOT, rel), "utf8")
    .replace(/^import[\s\S]*?from\s+"[^"]+";\s*$/gm, "")
    .replace(/^\/\/ eslint-disable-next-line[^\n]*\n/gm, "")
    .replace(/^const \w+ = require\([^\n]*\n/gm, "");
  const out = path.join(dir, path.basename(rel).replace(/\.ts$/, ".mts"));
  writeFileSync(out, header + "\n" + stripped);
  return out;
}
const unwrap = (ns: any) => (ns?.default && typeof ns.default === "object" && Object.keys(ns).length <= 2 ? ns.default : ns);
function requireStubs(rel: string): string {
  const src = readFileSync(path.join(ROOT, rel), "utf8");
  return [...src.matchAll(/^const (\w+) = require\(/gm)].map((m) => `const ${m[1]}: any = {};`).join(" ");
}
const maps = path.join(ROOT, "apps/askbible-mobile/src/i18n");
const configMod = pureModule("apps/askbible-mobile/src/i18n/config.ts",
  `const Platform = { OS: "ios" }; const NativeModules: any = {};`);
const copyMod = pureModule("apps/askbible-mobile/src/i18n/site-copy.ts",
  `import * as cm from "${maps}/site-copy-zh-tw-char-map"; import * as ph from "${maps}/site-copy-zh-tw-phrases"; import * as fx from "${maps}/site-copy-zh-tw-post-fixups";\n` +
  `const unwrap = (ns: any) => (ns?.default && typeof ns.default === "object" && Object.keys(ns).length <= 2 ? ns.default : ns);\n` +
  `const ZH_TW_CHAR_MAP = unwrap(cm).ZH_TW_CHAR_MAP; const ZH_TW_PHRASE_REPLACEMENTS = unwrap(ph).ZH_TW_PHRASE_REPLACEMENTS; const ZH_TW_POST_CHAR_MAP_FIXUPS = unwrap(fx).ZH_TW_POST_CHAR_MAP_FIXUPS;\n` +
  `const ZH_TW_OVERRIDES: any = {}; const getLocale = () => "zh-CN";\n` +
  // 被剔掉的 require 常量（en / zhCN 两份文案 JSON）补成空对象；toZhTwText 用不到它们
  requireStubs("apps/askbible-mobile/src/i18n/site-copy.ts"));
const displayMod = pureModule("apps/askbible-mobile/src/read/resolveReadDisplayLocale.ts", "");
const namesMod = pureModule("apps/askbible-mobile/src/bible/scripture-book-display-name.ts",
  `import * as bn from "${path.join(ROOT, "lib/bible/scripture-book-names-en")}"; import * as sb from "${path.join(ROOT, "lib/bible/scripture-books")}"; import * as sc from "${copyMod}";\n` +
  `const unwrap = (ns: any) => (ns?.default && typeof ns.default === "object" && Object.keys(ns).length <= 2 ? ns.default : ns);\n` +
  `const SCRIPTURE_BOOK_NAME_EN = unwrap(bn).SCRIPTURE_BOOK_NAME_EN; const scriptureBooks = unwrap(sb).scriptureBooks; const toZhTwText = unwrap(sc).toZhTwText; const getLocale = () => "zh-CN";`);
const C: any = unwrap(await import(configMod));
const S: any = unwrap(await import(copyMod));
const D: any = unwrap(await import(displayMod));
const N: any = unwrap(await import(namesMod));

const lines = readFileSync(0, "utf8").split("\n").filter((l) => l.length > 0);
const out: string[] = [];
for (const line of lines) {
  const f = line.split("\t");
  switch (f[0]) {
    case "tag": out.push(C.mapLanguageTagToAppLocale(f[1] ?? "")); break;
    case "display": out.push(D.resolveReadDisplayLocale({ appLocale: f[1], translationLanguage: f[2] || null })); break;
    case "zhtw": out.push(S.toZhTwText(f[1] ?? "")); break;
    case "book": out.push(N.getScriptureBookDisplayName(f[1], f[2])); break;
    // RN chapterTitleText / formatNeighborChapterLabel（useReadChapterScreenDisplay.ts）内联在 hook 里，这里照抄那两行
    case "title": out.push(f[3] === "en" ? `${f[1]} ${f[2]}` : `${f[1]} 第${f[2]}章`); break;
    case "label": out.push(f[2] === "en" ? `Chapter ${f[1]}` : `第${f[1]}章`); break;
    default: out.push("skip");
  }
}
process.stdout.write(JSON.stringify(out));
