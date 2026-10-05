#!/usr/bin/env node
/**
 * 补传 data/nature-settings.json 引用、但 R2 上还没有的自然场景视频（D-33 / O-30）。
 *
 *   node scripts/upload-missing-nature-videos-r2.mjs --dry-run   # 只看缺哪些
 *   node scripts/upload-missing-nature-videos-r2.mjs             # 补传缺的
 *
 * iOS / 安卓非默认场景直接从 R2 读 `nature/uploads/<hash>-720.mp4`（与配置里的 src 同路径），
 * 文件名带 hash、内容不会变，所以只按「线上 404」判断要不要传，已在的不重传。
 * 认证走 wrangler OAuth（与 upload-mobile-config-r2.mjs 一致）。ship:data 会自动调用。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const settingsPath = path.join(repoRoot, "data", "nature-settings.json");
const bucket = process.env.R2_BUCKET || "askbible-media";
const publicBase =
  process.env.R2_PUBLIC_BASE_URL || "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev";
const dryRun = process.argv.includes("--dry-run");

/** 配置里所有 /nature/uploads/*-720.mp4（App 只读 720 档）。 */
function referencedVideos() {
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  const srcs = new Set();
  for (const v of settings.videos ?? []) {
    if (typeof v.src === "string" && /^\/nature\/uploads\/[^/]+-720\.mp4$/.test(v.src)) srcs.add(v.src);
  }
  return [...srcs].sort();
}

async function remoteStatus(key) {
  const res = await fetch(`${publicBase}/${key}`, { method: "HEAD", cache: "no-store" });
  return { status: res.status, length: Number(res.headers.get("content-length") ?? -1) };
}

function putWithWrangler(absPath, key) {
  const res = spawnSync(
    "npx",
    [
      "--no-install",
      "wrangler",
      "r2",
      "object",
      "put",
      `${bucket}/${key}`,
      "--file",
      absPath,
      "--content-type",
      "video/mp4",
      "--remote",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (res.status !== 0) {
    throw new Error(`上传失败 ${key}：${(res.stderr || res.stdout || "").slice(0, 400)}`);
  }
}

async function main() {
  const srcs = referencedVideos();
  const missing = [];
  for (const src of srcs) {
    const key = src.slice(1);
    const { status } = await remoteStatus(key);
    if (status === 200) continue;
    if (status !== 404) throw new Error(`查询 ${key} 返回 HTTP ${status}，先别传`);
    const abs = path.join(repoRoot, "public", key);
    if (!fs.existsSync(abs)) throw new Error(`R2 缺 ${key}，本地也没有 ${path.relative(repoRoot, abs)}`);
    missing.push({ abs, key, bytes: fs.statSync(abs).size });
  }

  if (missing.length === 0) {
    console.log(`自然场景视频：配置引用 ${srcs.length} 个，R2 上全都有。`);
    return;
  }
  console.log(`${dryRun ? "[dry-run] " : ""}自然场景视频：R2 缺 ${missing.length} 个，补传到 ${bucket}`);
  for (const { abs, key, bytes } of missing) {
    console.log(`  ${String(bytes).padStart(9)} B  ${key}`);
    if (!dryRun) putWithWrangler(abs, key);
  }
  if (dryRun) return;

  let bad = 0;
  for (const { key, bytes } of missing) {
    const { status, length } = await remoteStatus(key);
    const ok = status === 200 && length === bytes;
    if (!ok) bad += 1;
    console.log(`  ${ok ? "✓" : "✗"} HTTP ${status} ${length}B  ${key}`);
  }
  if (bad > 0) {
    console.error(`\n${bad} 个回读不对，App 里这些场景会播不了。`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
