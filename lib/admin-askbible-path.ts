import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * AskBible 2 认证库路径（与旧站 `admin_data/auth.sqlite` 相同文件即可复用账号）。
 * 优先级：`ASKBIBLE_AUTH_SQLITE_PATH` → `ASKBIBLE_REPO/admin_data/auth.sqlite` → 本机默认桌面路径。
 */
export function getAskbibleAuthSqlitePath(): string | null {
  const explicit = process.env.ASKBIBLE_AUTH_SQLITE_PATH?.trim();
  if (explicit) {
    const abs = path.isAbsolute(explicit) ? explicit : path.resolve(process.cwd(), explicit);
    if (fs.existsSync(abs)) return abs;
    return null;
  }
  const dataRoot = process.env.DATA_ROOT?.trim();
  if (dataRoot) {
    const p = path.join(path.resolve(dataRoot), "admin_data", "auth.sqlite");
    if (fs.existsSync(p)) return p;
  }
  const repo = process.env.ASKBIBLE_REPO?.trim();
  if (repo) {
    const p = path.join(path.resolve(repo), "admin_data", "auth.sqlite");
    if (fs.existsSync(p)) return p;
  }
  const def = path.join(os.homedir(), "Desktop", "APP", "01 AskBible 2", "admin_data", "auth.sqlite");
  if (fs.existsSync(def)) return def;
  return null;
}
