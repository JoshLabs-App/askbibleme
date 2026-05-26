import { getReaderVerseThemesDatabase, readerVerseThemesSqlitePath } from "@/lib/scripture/reader-verse-themes-db";
import { listThemeRepeatPoolSourceRows } from "@/lib/scripture/reader-verse-repeat-rank";
import { themeRepeatPoolScopeId } from "@/lib/scripture/theme-repeat-pool-scope-id";
import { verseKeyFromVerseRef } from "@/lib/home-prayer-pools/verse-key-from-ref";
import {
  readThemeRepeatAllowlistVerseKeys,
  writeThemeRepeatAllowlist,
  type ThemeRepeatAllowlistRow,
} from "@/lib/home-prayer-pools/theme-repeat-allowlist";
import { resolveVerseRefToHomeEntry } from "@/lib/bible/resolve-verse-range-for-display";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length).trim();
  }
  return undefined;
}

function readNumArg(name: string): number | undefined {
  const raw = readArg(name);
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function readKeyListArg(name: string): string[] {
  const raw = readArg(name);
  if (!raw) return [];
  return raw
    .split(",")
    .map((k) => k.trim().toUpperCase())
    .filter(Boolean);
}

function fallbackRef(bookId: string, chapter: number, verse: number): string {
  return `${bookId} ${chapter}:${verse}`;
}

async function main() {
  const cwd = process.cwd();
  const minCount = readNumArg("min") ?? 5;
  const maxCount = readNumArg("max");
  const cap = readNumArg("cap");
  const removeKeys = new Set(readKeyListArg("remove"));
  const addKeys = new Set(readKeyListArg("add"));
  const scopeId = themeRepeatPoolScopeId(minCount);
  const dbPath = readerVerseThemesSqlitePath(cwd);

  const fs = await import("node:fs");
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Missing ${dbPath}. Run: npm run import:reader-verse-themes`);
  }
  const db = await getReaderVerseThemesDatabase(cwd);
  if (!db) throw new Error("Failed to open reader-verse-themes.sqlite");

  const mtimeMs = fs.statSync(dbPath).mtimeMs;
  const sourceRows = listThemeRepeatPoolSourceRows(db, { minCount, maxCount, cap, mtimeMs });
  const sourceByKey = new Map<
    string,
    { bookId: string; chapter: number; verse: number; repeatCount: number }
  >();
  for (const row of sourceRows) {
    const verseKey = verseKeyFromVerseRef({
      bookId: row.bookId,
      chapter: row.chapter,
      verseStart: row.verse,
      verseEnd: row.verse,
    });
    sourceByKey.set(verseKey, row);
  }

  const existing = readThemeRepeatAllowlistVerseKeys(cwd, scopeId);
  const allowKeys = new Set<string>();
  if (existing) {
    for (const key of existing) {
      if (sourceByKey.has(key)) allowKeys.add(key);
    }
  } else {
    for (const key of sourceByKey.keys()) allowKeys.add(key);
  }

  for (const key of removeKeys) allowKeys.delete(key);
  for (const key of addKeys) {
    if (sourceByKey.has(key)) allowKeys.add(key);
  }

  const rows: ThemeRepeatAllowlistRow[] = [];
  for (const [verseKey, row] of sourceByKey.entries()) {
    if (!allowKeys.has(verseKey)) continue;
    const ref = {
      bookId: row.bookId,
      chapter: row.chapter,
      verseStart: row.verse,
      verseEnd: row.verse,
      translationId: "cuv-simp",
    };
    const zh = await resolveVerseRefToHomeEntry(cwd, ref, "zh-CN");
    rows.push({
      verseKey,
      repeatCount: Math.max(1, row.repeatCount),
      reference: zh?.ref?.trim() || fallbackRef(row.bookId, row.chapter, row.verse),
      text: zh?.lines?.join(" ") ?? "",
    });
  }

  const filePath = writeThemeRepeatAllowlist(cwd, scopeId, rows);
  console.log(
    `[theme-repeat-allowlist] ${scopeId}: wrote ${rows.length}/${sourceRows.length} rows to ${filePath}`,
  );
  if (removeKeys.size > 0) {
    console.log(`[theme-repeat-allowlist] removed: ${Array.from(removeKeys).join(", ")}`);
  }
  if (addKeys.size > 0) {
    console.log(`[theme-repeat-allowlist] added: ${Array.from(addKeys).join(", ")}`);
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
