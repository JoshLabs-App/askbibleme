import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import initSqlJs from "sql.js";

type SqlJsDb = {
  prepare: (sql: string) => {
    bind: (params: unknown[]) => void;
    step: () => boolean;
    getAsObject: () => Record<string, unknown>;
    free: () => void;
  };
  run: (sql: string, params?: unknown[]) => void;
  export: () => Uint8Array;
  close: () => void;
};

type AskbibleSqlUser = {
  id: string;
  email: string;
  name: string;
};

async function openDb(dbPath: string): Promise<{ db: SqlJsDb; close: () => void; save: () => void }> {
  const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const fileBytes = fs.readFileSync(dbPath);
  const db = new SQL.Database(new Uint8Array(fileBytes)) as unknown as SqlJsDb;
  return {
    db,
    save: () => {
      const out = db.export();
      fs.writeFileSync(dbPath, Buffer.from(out));
    },
    close: () => db.close(),
  };
}

function getTableColumns(db: SqlJsDb, table: string): Set<string> {
  const cols = new Set<string>();
  const stmt = db.prepare(`PRAGMA table_info(${table})`);
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const col = String(row.name ?? "").trim();
    if (col) cols.add(col);
  }
  stmt.free();
  return cols;
}

function normalizeEmail(v: string): string {
  return String(v || "").trim().toLowerCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function getAskbibleUserById(dbPath: string, userId: string): Promise<AskbibleSqlUser | null> {
  const { db, close } = await openDb(dbPath);
  try {
    const stmt = db.prepare("SELECT id, name, email FROM users WHERE id = ? LIMIT 1");
    stmt.bind([userId]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const row = stmt.getAsObject();
    stmt.free();
    const email = String(row.email ?? "").trim();
    if (!email) return null;
    return {
      id: String(row.id ?? "").trim(),
      email,
      name: String(row.name ?? "").trim() || email,
    };
  } finally {
    close();
  }
}

export async function registerAskbibleSqliteUser(input: {
  dbPath: string;
  email: string;
  password: string;
  name?: string;
}): Promise<{ ok: true; user: AskbibleSqlUser } | { ok: false; status: number; error: string }> {
  const { dbPath, email, password, name = "" } = input;
  const normalizedEmail = normalizeEmail(email);
  const safePassword = String(password || "");
  const safeName = String(name || "").trim();

  if (!normalizedEmail || !safePassword) {
    return { ok: false, status: 400, error: "缺少邮箱或密码" };
  }
  if (safePassword.length < 8) {
    return { ok: false, status: 400, error: "密码至少需要8位" };
  }

  const { db, close, save } = await openDb(dbPath);
  try {
    const existsStmt = db.prepare("SELECT id FROM users WHERE lower(trim(email)) = lower(trim(?)) LIMIT 1");
    existsStmt.bind([normalizedEmail]);
    const exists = existsStmt.step();
    existsStmt.free();
    if (exists) {
      return { ok: false, status: 409, error: "该邮箱已被注册" };
    }

    const columns = getTableColumns(db, "users");
    const id = randomUUID();
    const createdAt = nowIso();
    const hashed = bcrypt.hashSync(safePassword, 10);
    const finalName = safeName || normalizedEmail;

    const colNames: string[] = [];
    const placeholders: string[] = [];
    const values: unknown[] = [];
    const pushCol = (col: string, val: unknown) => {
      if (!columns.has(col)) return;
      colNames.push(col);
      placeholders.push("?");
      values.push(val);
    };

    pushCol("id", id);
    pushCol("name", finalName);
    pushCol("email", normalizedEmail);
    pushCol("password_hash", hashed);
    pushCol("created_at", createdAt);
    pushCol("updated_at", createdAt);
    pushCol("is_admin", 0);
    pushCol("admin_role", "");
    pushCol("online_seconds_total", 0);
    pushCol("color_theme_id", "");

    if (colNames.length < 4) {
      return { ok: false, status: 500, error: "auth.sqlite users 表结构异常" };
    }

    db.run(`INSERT INTO users (${colNames.join(", ")}) VALUES (${placeholders.join(", ")})`, values);
    save();
    return {
      ok: true,
      user: { id, email: normalizedEmail, name: finalName },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "sqlite 写入失败";
    return { ok: false, status: 500, error: message };
  } finally {
    close();
  }
}
