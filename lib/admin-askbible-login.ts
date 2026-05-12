import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import initSqlJs from "sql.js";

/** 与 AskBible `apps/web/lib/auth-store.ts` 的 `verifyPassword` 一致 */
function verifyPasswordLikeAskBible(plain: string, stored: string): boolean {
  if (!stored) return false;
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    return bcrypt.compareSync(plain, stored);
  }
  const legacySha = createHash("sha256").update(plain).digest("hex");
  return stored === legacySha;
}

/**
 * 用 AskBible `auth.sqlite` 校验：须 `is_admin = 1` 且密码匹配（bcrypt 或旧 SHA256）。
 */
export async function verifyAskbibleAdminCredentials(
  dbPath: string,
  email: string,
  password: string,
): Promise<{ ok: true; userId: string; email: string } | { ok: false }> {
  const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(new Uint8Array(buf));

  const stmt = db.prepare(
    "SELECT id, email, password_hash FROM users WHERE lower(trim(email)) = lower(trim(?)) AND is_admin = 1 LIMIT 1",
  );
  stmt.bind([email]);
  if (!stmt.step()) {
    stmt.free();
    db.close();
    return { ok: false };
  }
  const row = stmt.getAsObject() as { id?: unknown; email?: unknown; password_hash?: unknown };
  stmt.free();
  db.close();

  const hash = String(row.password_hash ?? "");
  if (!verifyPasswordLikeAskBible(password, hash)) return { ok: false };
  return { ok: true, userId: String(row.id ?? ""), email: String(row.email ?? "") };
}

/**
 * 任意 AskBible `users` 行（与旧站相同库）：不要求 `is_admin`，密码算法与 {@link verifyAskbibleAdminCredentials} 一致。
 */
export async function verifyAskbibleUserCredentials(
  dbPath: string,
  email: string,
  password: string,
): Promise<{ ok: true; userId: string; email: string; name: string } | { ok: false }> {
  const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(new Uint8Array(buf));

  const stmt = db.prepare(
    "SELECT id, name, email, password_hash FROM users WHERE lower(trim(email)) = lower(trim(?)) LIMIT 1",
  );
  stmt.bind([email]);
  if (!stmt.step()) {
    stmt.free();
    db.close();
    return { ok: false };
  }
  const row = stmt.getAsObject() as {
    id?: unknown;
    name?: unknown;
    email?: unknown;
    password_hash?: unknown;
  };
  stmt.free();
  db.close();

  const hash = String(row.password_hash ?? "");
  if (!verifyPasswordLikeAskBible(password, hash)) return { ok: false };
  return {
    ok: true,
    userId: String(row.id ?? ""),
    email: String(row.email ?? ""),
    name: String(row.name ?? "").trim() || String(row.email ?? ""),
  };
}
