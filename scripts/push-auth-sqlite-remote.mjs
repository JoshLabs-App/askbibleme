#!/usr/bin/env node
/**
 * 将本机 auth.sqlite 推到 Render 持久盘（或其它主机）。
 *
 * 环境变量：
 *   AUTH_SQLITE_REMOTE_SCP_TARGET=user@ssh.render.com:/var/data/admin_data/auth.sqlite
 *   AUTH_SQLITE_SOURCE=/path/to/auth.sqlite  （可选）
 *
 * 示例：
 *   AUTH_SQLITE_REMOTE_SCP_TARGET='srv-xxx@ssh.oregon.render.com:/var/data/admin_data/auth.sqlite' \
 *     npm run auth:push-remote
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cwd = process.cwd();

function resolveSource() {
  const fromEnv = process.env.AUTH_SQLITE_SOURCE?.trim() || process.env.ASKBIBLE_AUTH_SQLITE_PATH?.trim();
  if (fromEnv) {
    const abs = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(cwd, fromEnv);
    if (fs.existsSync(abs)) return abs;
  }
  const repo = process.env.ASKBIBLE_REPO?.trim();
  if (repo) {
    const p = path.join(path.resolve(repo), "admin_data", "auth.sqlite");
    if (fs.existsSync(p)) return p;
  }
  const candidates = [
    path.join(os.homedir(), "Desktop", "APP", "AskOLD", "admin_data", "auth.sqlite"),
    path.join(os.homedir(), "Desktop", "APP", "01 AskBible 2", "admin_data", "auth.sqlite"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return "";
}

const target = process.env.AUTH_SQLITE_REMOTE_SCP_TARGET?.trim();
if (!target) {
  console.error(
    [
      "未配置远端 SCP 目标。示例：",
      "  AUTH_SQLITE_REMOTE_SCP_TARGET='srv-xxx@ssh.oregon.render.com:/var/data/admin_data/auth.sqlite' npm run auth:push-remote",
      "",
      "或在 Render Shell 内：",
      "  DATA_ROOT=/var/data AUTH_SQLITE_SOURCE=/tmp/auth.sqlite node scripts/sync-auth-sqlite-to-data-root.mjs",
    ].join("\n"),
  );
  process.exit(1);
}

const src = resolveSource();
if (!src) {
  console.error("Local auth.sqlite not found. Set AUTH_SQLITE_SOURCE or ASKBIBLE_AUTH_SQLITE_PATH.");
  process.exit(1);
}

const stat = fs.statSync(src);
console.log(`Pushing ${src} (${stat.size} bytes) → ${target}`);

const remoteHost = target.includes(":") ? target.split(":")[0] : "";
const remotePath = target.includes(":") ? target.slice(target.indexOf(":") + 1) : target;
if (remoteHost && remotePath) {
  const remoteDir = path.posix.dirname(remotePath);
  spawnSync("ssh", [remoteHost, `mkdir -p ${remoteDir}`], { stdio: "inherit" });
}

const scp = spawnSync("scp", [src, target], { stdio: "inherit" });
if (scp.status !== 0) process.exit(scp.status ?? 1);
console.log("Done.");
