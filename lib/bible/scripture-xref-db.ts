import fs from "node:fs";
import type { Database } from "sql.js";
import { getSqlJsStatic } from "@/lib/bible/sql-js-wasm";
import { scriptureXrefSqlitePath } from "@/lib/bible/scripture-xref-sqlite-path";

let cache: { mtimeMs: number; db: Database } | null = null;

export async function getScriptureXrefDatabase(cwd: string): Promise<Database | null> {
  const abs = scriptureXrefSqlitePath(cwd);
  if (!fs.existsSync(abs)) return null;
  const st = fs.statSync(abs);
  if (cache && cache.mtimeMs === st.mtimeMs) return cache.db;

  if (cache) {
    try {
      cache.db.close();
    } catch {
      /* ignore */
    }
    cache = null;
  }

  const SQL = await getSqlJsStatic(cwd);
  const buf = fs.readFileSync(abs);
  const db = new SQL.Database(new Uint8Array(buf));
  cache = { mtimeMs: st.mtimeMs, db };
  return db;
}

export function invalidateScriptureXrefCache(): void {
  if (cache) {
    try {
      cache.db.close();
    } catch {
      /* ignore */
    }
    cache = null;
  }
}
