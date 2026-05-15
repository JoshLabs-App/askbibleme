import fs from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";

type SqlJsDatabase = InstanceType<Awaited<ReturnType<typeof initSqlJs>>["Database"]>;

/** 相对仓库根；不入库大文件时可只存在本机。 */
export const OPENBIBLE_TOPICS_SQLITE_REL = "data/bible/openbible-topics.sqlite";

export function openbibleTopicsSqlitePath(cwd: string): string {
  return path.join(cwd, OPENBIBLE_TOPICS_SQLITE_REL);
}

export const OPENBIBLE_TOPICS_DDL = `
CREATE TABLE IF NOT EXISTS openbible_topic_row (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  osis TEXT NOT NULL,
  quality_score INTEGER NOT NULL,
  verse_count INTEGER,
  dir_quiet INTEGER DEFAULT 0,
  dir_pray INTEGER DEFAULT 0,
  dir_form INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_openbible_topic ON openbible_topic_row(topic);
CREATE INDEX IF NOT EXISTS idx_openbible_osis ON openbible_topic_row(osis);
CREATE INDEX IF NOT EXISTS idx_openbible_score ON openbible_topic_row(quality_score);
CREATE INDEX IF NOT EXISTS idx_openbible_verse_count ON openbible_topic_row(verse_count);
CREATE TABLE IF NOT EXISTS openbible_import_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

let cached: { absPath: string; mtimeMs: number; db: SqlJsDatabase } | null = null;

export async function getOpenbibleTopicsDatabase(cwd: string): Promise<SqlJsDatabase | null> {
  const absPath = openbibleTopicsSqlitePath(cwd);
  if (!fs.existsSync(absPath)) {
    if (cached) {
      try {
        cached.db.close();
      } catch {
        /* ignore */
      }
      cached = null;
    }
    return null;
  }
  const mtimeMs = fs.statSync(absPath).mtimeMs;
  if (cached && cached.absPath === absPath && cached.mtimeMs === mtimeMs) {
    return cached.db;
  }
  if (cached) {
    try {
      cached.db.close();
    } catch {
      /* ignore */
    }
    cached = null;
  }
  const wasmPath = path.join(cwd, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const buf = fs.readFileSync(absPath);
  const db = new SQL.Database(new Uint8Array(buf));
  cached = { absPath, mtimeMs, db };
  return db;
}

export function invalidateOpenbibleTopicsDbCache(): void {
  if (cached) {
    try {
      cached.db.close();
    } catch {
      /* ignore */
    }
    cached = null;
  }
}

/** 当前库是否已有 `verse_count` 列（旧库须迁移后才可按节数筛选）。 */
export function openbibleTopicsDbHasVerseCountColumn(db: SqlJsDatabase): boolean {
  const stmt = db.prepare("PRAGMA table_info(openbible_topic_row)");
  try {
    while (stmt.step()) {
      const o = stmt.getAsObject() as { name?: string };
      if (String(o.name ?? "") === "verse_count") return true;
    }
    return false;
  } finally {
    stmt.free();
  }
}

/** 当前库是否已有陪伴方向三列 `dir_quiet` / `dir_pray` / `dir_form`。 */
export function openbibleTopicsDbHasCompanionDirectionColumns(db: SqlJsDatabase): boolean {
  const stmt = db.prepare("PRAGMA table_info(openbible_topic_row)");
  const names = new Set<string>();
  try {
    while (stmt.step()) {
      const o = stmt.getAsObject() as { name?: string };
      const n = String(o.name ?? "");
      if (n) names.add(n);
    }
  } finally {
    stmt.free();
  }
  return names.has("dir_quiet") && names.has("dir_pray") && names.has("dir_form");
}
