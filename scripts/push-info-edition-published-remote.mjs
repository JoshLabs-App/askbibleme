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
const target = process.env.INFO_EDITION_REMOTE_SCP_TARGET?.trim();

if (!target) {
  console.error(
    "Set INFO_EDITION_REMOTE_SCP_TARGET, e.g. user@host:/var/data/info-edition-v1-published.json",
  );
  process.exit(1);
}

if (!fs.existsSync(src)) {
  console.error(`Source not found: ${src}`);
  process.exit(1);
}

const stat = fs.statSync(src);
console.log(`Pushing ${src} (${stat.size} bytes) → ${target}`);

const r = spawnSync("scp", [src, target], { stdio: "inherit" });
if (r.status !== 0) {
  process.exit(r.status ?? 1);
}

console.log("Push OK.");
