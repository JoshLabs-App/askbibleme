#!/usr/bin/env node
/**
 * DEPRECATED: AskBible 不再托管潮语新约音频（不落 public/、不落 DATA_ROOT）。
 * App / Web 只引用 manifest 里的 TSTSCC remoteUrl。
 * 若仍要本机镜像（例如生成 timing），设 FORCE_TEOCHEW_LOCAL_MIRROR=1。
 */
if (process.env.FORCE_TEOCHEW_LOCAL_MIRROR !== "1") {
  console.error(
    "Refusing: teochew-nt is external-only (TSTSCC). Set FORCE_TEOCHEW_LOCAL_MIRROR=1 to override.",
  );
  process.exit(1);
}

/**
 * 用 rsync 将本机 public/audio/teochew-nt/ 推到 Render 持久盘（或其它主机）。
 *
 *   TEOCHEW_AUDIO_REMOTE_RSYNC_TARGET='user@ssh.render.com:/var/data/audio/teochew-nt/' \
 *     npm run audio:teochew-push-remote
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const src = path.join(cwd, "public", "audio", "teochew-nt");
const target = process.env.TEOCHEW_AUDIO_REMOTE_RSYNC_TARGET?.trim();

if (!target) {
  console.error(
    "Set TEOCHEW_AUDIO_REMOTE_RSYNC_TARGET, e.g. user@ssh.render.com:/var/data/audio/teochew-nt/",
  );
  process.exit(1);
}

if (!fs.existsSync(src)) {
  console.error(`Source not found: ${src}. Run: npm run audio:teochew-pull`);
  process.exit(1);
}

const count = fs.readdirSync(src).filter((n) => /^[A-Z0-9]{2,8}-\d+\.mp3$/i.test(n)).length;
if (count === 0) {
  console.error(`No MP3s in ${src}`);
  process.exit(1);
}

const srcTrail = src.endsWith(path.sep) ? src : `${src}${path.sep}`;
console.log(`Rsync ${count} files: ${srcTrail} → ${target}`);

const r = spawnSync(
  "rsync",
  ["-avz", "--progress", "--partial", srcTrail, target],
  { stdio: "inherit" },
);
if (r.status !== 0) {
  process.exit(r.status ?? 1);
}

console.log("Push OK.");
