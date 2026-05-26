#!/usr/bin/env node
/**
 * 将本机 data/bible/info-edition-v1-published.json 推到 Render 持久盘（或其它主机）。
 *
 * 环境变量：
 *   INFO_EDITION_REMOTE_SCP_TARGET=user@ssh-host:/var/data/info-edition-v1-published.json
 *
 * 示例（Render SSH，主机名以控制台为准）：
 *   INFO_EDITION_REMOTE_SCP_TARGET='srv-xxx@ssh.oregon.render.com:/var/data/info-edition-v1-published.json' \
 *     npm run info-edition:push-remote
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const src = path.join(cwd, "data", "bible", "info-edition-v1-published.json");

function resolveRemoteTarget() {
  const fromEnv = process.env.INFO_EDITION_REMOTE_SCP_TARGET?.trim();
  if (fromEnv) return fromEnv;
  const uiPath = path.join(cwd, "data", "bible", "info-edition-v1-batch-ui.json");
  if (!fs.existsSync(uiPath)) return "";
  try {
    const ui = JSON.parse(fs.readFileSync(uiPath, "utf8"));
    return typeof ui.remoteScpTarget === "string" ? ui.remoteScpTarget.trim() : "";
  } catch {
    return "";
  }
}

const target = resolveRemoteTarget();

if (!target) {
  console.error(
    [
      "未配置 Render SSH 目标。任选其一：",
      "  1) INFO_EDITION_REMOTE_SCP_TARGET='user@ssh.render.com:/var/data/info-edition-v1-published.json' npm run info-edition:push-remote",
      "  2) 在 data/bible/info-edition-v1-batch-ui.json 填写 remoteScpTarget 后再运行本命令",
      "  3) Render Shell：git pull && DATA_ROOT=/var/data npm run info-edition:sync-disk",
    ].join("\n"),
  );
  process.exit(1);
}

if (!fs.existsSync(src)) {
  console.error(`Source not found: ${src}`);
  process.exit(1);
}

const stat = fs.statSync(src);
console.log(`Pushing ${src} (${stat.size} bytes) → ${target}`);
console.log("将覆盖远端同名文件（整本 published）。");

const remoteHost = target.includes(":") ? target.split(":")[0] : "";
const remotePath = target.includes(":") ? target.slice(target.indexOf(":") + 1) : target;
if (remoteHost && remotePath) {
  const backup = `${remotePath}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  spawnSync(
    "ssh",
    [remoteHost, `test -f '${remotePath}' && cp '${remotePath}' '${backup}' || true`],
    { stdio: "inherit" },
  );
  console.log(`远端若已有旧文件，已备份为 ${backup}`);
}

const r = spawnSync("scp", [src, target], { stdio: "inherit" });
if (r.status !== 0) {
  process.exit(r.status ?? 1);
}

console.log("Push OK.");
