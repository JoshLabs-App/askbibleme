/**
 * 经文搜索 / 收藏规则的 TS 期望值。
 * `scripture-search.ts` 顶部 import 了带 RN 依赖的书名模块，不能直接 import；这里把它的源码去掉 import 行后
 * 与纯依赖（lib/bible/scripture-books）拼成临时模块再加载，书名函数用 bookId 顶替（用例只比规则，不比书名）。
 * `scripture-verse-bookmark-store.ts` 是纯模块，直接 import。最近搜索的 push / normalizeTerms 同理拼装。
 */
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(path.join(tmpdir(), "scripture-search-ts-"));

function pureModule(rel: string, header: string): string {
  // 把源码里的 import（含多行 import { ... } from "..."）全剔掉，再拼上我们自己的纯依赖头
  const stripped = readFileSync(path.join(ROOT, rel), "utf8").replace(/^import[\s\S]*?from\s+"[^"]+";\s*$/gm, "");
  const out = path.join(dir, path.basename(rel).replace(/\.ts$/, ".mts"));
  writeFileSync(out, header + "\n" + stripped);
  return out;
}

const searchMod = pureModule("apps/askbible-mobile/src/bible/scripture-search.ts",
  // tsx 把 TS 编成 CJS 再由 ESM 引用，命名导入会失败 —— 走命名空间 + unwrap default（本仓库对拍脚本的惯例）
  `import * as booksNs from "${path.join(ROOT, "lib/bible/scripture-books")}";\n` +
  `const booksMod: any = (booksNs as any).scriptureBooks ? booksNs : (booksNs as any).default;\n` +
  `const scriptureBooks = booksMod.scriptureBooks; const testamentForBookNumber = booksMod.testamentForBookNumber;\n` +
  `function getScriptureBookDisplayName(id: string) { return id; }\ntype ScriptureTestament = "old" | "new";`);
const recentMod = pureModule("apps/askbible-mobile/src/read/scripture-recent-searches.ts",
  `const AsyncStorage = { getItem: async () => null, setItem: async () => {} };\nconst SCRIPTURE_SEARCH_MIN_LEN = 1;`);

// 译本偏好：模块顶层拉了 AsyncStorage / 语言选译本 / 朗读译本归一化，都换成桩；写入落在 __store 里供 tpser 取回
const prefsMod = pureModule("apps/askbible-mobile/src/read/read-bible-translation-prefs.ts",
  `export const __store: Record<string, string> = {};
` +
  `const AsyncStorage = { async getItem(k: string) { return __store[k] ?? null; }, async setItem(k: string, v: string) { __store[k] = v; }, async removeItem(k: string) { delete __store[k]; } };
` +
  `function pickTranslationIdForLocale() { return null; }
` +
  `function normalizeReadBibleAudioTranslationId() { return null; }
` +
  `type AppLocale = string; type BibleTranslationsIndex = { translations: { id: string }[]; defaultTranslationId?: string };`);

const search: any = await import(searchMod);
const prefsNs: any = await import(prefsMod);
const recent: any = await import(recentMod);
const bm: any = await import(path.join(ROOT, "apps/askbible-mobile/src/bible/scripture-verse-bookmark-store.ts"));
const unwrap = (ns: any) => (ns?.default && typeof ns.default === "object" && Object.keys(ns).length <= 2 ? ns.default : ns);
const S = unwrap(search), R = unwrap(recent), B = unwrap(bm), T = unwrap(prefsNs);
const ALL_IDS = ["cuv-simp", "cuv-trad", "web-en", "ust-en"];

const lines = readFileSync(0, "utf8").split("\n").filter((l) => l.length > 0);
const out: string[] = [];
for (const line of lines) {
  const f = line.split("\t");
  switch (f[0]) {
    case "norm": out.push(S.normalizeScriptureSearchQuery(f[1])); break;
    case "esc": out.push(S.escapeSqliteLikePattern(f[1])); break;
    case "scope": {
      const ref = f[4] ? { bookId: f[4], chapter: Number(f[5]) } : null;
      out.push(S.isVerseInScriptureSearchScope(f[1], Number(f[2]), f[3], ref) ? "1" : "0"); break;
    }
    case "split": out.push(JSON.stringify(S.splitTextByScriptureSearchKeyword(f[1], f[2]))); break;
    case "recent": {
      // pushScriptureRecentSearch 依赖存储；用它的纯规则等价式：新词在前、去重（不分大小写）、封顶 8
      const terms: string[] = JSON.parse(f[1]);
      const normalized = f[2].trim().replace(/\s+/g, " ");
      if (normalized.length < 1) { out.push(JSON.stringify(R.parseScriptureRecentSearchesRecord(JSON.stringify(terms)).terms)); break; }
      const next = [normalized, ...terms.filter((t: string) => t.toLowerCase() !== normalized.toLowerCase())].slice(0, 8);
      out.push(JSON.stringify(R.parseScriptureRecentSearchesRecord(JSON.stringify(next)).terms)); break;
    }
    case "recentnorm": out.push(JSON.stringify(R.parseScriptureRecentSearchesRecord(f[1]).terms)); break;
    case "bmkey": out.push(B.scriptureVerseBookmarkKey({ translationId: f[1], bookId: f[2], chapter: Number(f[3]), verse: Number(f[4]) })); break;
    case "bmparse": {
      const store = B.parseScriptureVerseBookmarkStore(f[1] || null);
      const norm: Record<string, unknown> = {};
      for (const k of Object.keys(store).sort()) { const { savedAt, ...rest } = store[k]; norm[k] = { ...rest, savedAtSet: typeof savedAt === "number" }; }
      out.push(JSON.stringify(norm)); break;
    }
    case "tpparse": {
      const allowed = f[2].split(",");
      const p = T.parseReadBibleTranslationPrefs(f[1] || null, { translations: allowed.map((id: string) => ({ id })), defaultTranslationId: f[3] });
      out.push(JSON.stringify({ primary: p.primaryTranslationId, secondary: p.contrastTranslationIds[0] ?? null })); break;
    }
    case "tpser": {
      await T.writeReadBibleTranslationPrefs(
        { version: 1, primaryTranslationId: f[1], contrastTranslationIds: f[2] ? [f[2]] : [], audioTranslationId: null },
        { translations: ALL_IDS.map((id) => ({ id })) });
      out.push(T.__store["selah_read_bible_translation_v1"]); break;
    }
    default: out.push("skip");
  }
}
process.stdout.write(JSON.stringify(out));
