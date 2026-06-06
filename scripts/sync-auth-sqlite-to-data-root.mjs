#!/usr/bin/env node
/**
 * 将本机 auth.sqlite 复制到 DATA_ROOT/admin_data/auth.sqlite（Render Shell 或本机对齐磁盘布局）。
 *
 * 环境变量：
 *   DATA_ROOT=/var/data
 *   AUTH_SQLITE_SOURCE=/path/to/auth.sqlite   （可选；默认 ASKBIBLE_AUTH_SQLITE_PATH → AskOLD 桌面路径）
 *
 * 示例（Render Shell）：
 *   DATA_ROOT=/var/data AUTH_SQLITE_SOURCE=/tmp/auth.sqlite node scripts/sync-auth-sqlite-to-data-root.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cwd = process.cwd();

function resolveSource() {
  const fromEnv = process.env.AUTH_SQLITE_SOURCE?.trim() || process.env.ASKBIBLE_AUTH_SQLITE_PATH?.trim();
  if (fromEnv) {
    const abs = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(cwd, fromEnv);
    if (fs.existsSync(abs)) return abs;
    console.error(`Source not found: ${abs}`);
    process.exit(1);
  }
  const repo = process.env.ASKBIBLE_REPO?.trim();
  if (repo) {
    const p = path.join(path.resolve(repo), "admin_data", "auth.sqlite");
    if (fs.existsSync(p)) return p;
  }
  const def = path.join(os.homedir(), "Desktop", "APP", "AskOLD", "admin_data", "auth.sqlite");
  if (fs.existsSync(def)) return def;
  const legacy = path.join(os.homedir(), "Desktop", "APP", "01 AskBible 2", "admin_data", "auth.sqlite");
  if (fs.existsSync(legacy)) return legacy;
  console.error(
    "No auth.sqlite source. Set AUTH_SQLITE_SOURCE or ASKBIBLE_AUTH_SQLITE_PATH, or place file under AskOLD/admin_data/.",
  );
  process.exit(1);
}

const dataRoot = process.env.DATA_ROOT?.trim();
if (!dataRoot) {
  console.error("DATA_ROOT is required (e.g. /var/data on Render persistent disk).");
  process.exit(1);
}

const src = resolveSource();
const destDir = path.join(path.resolve(dataRoot), "admin_data");
const dest = path.join(destDir, "auth.sqlite");

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
const stat = fs.statSync(dest);
console.log(`Copied ${src} → ${dest} (${stat.size} bytes)`);
