#!/usr/bin/env node
/**
 * TEMPORARY：原样上传金句 mp3 到 Cloudflare R2（不压缩、不转码）。
 *
 * 前置：Dashboard 开通 R2 → 本脚本可建桶（若无）并上传。
 *
 * 环境变量：
 *   R2_BUCKET                 默认 askbible-media
 *   R2_PUBLIC_BASE_URL        上传后打印；写入 EXPO_PUBLIC_GOLDEN_VERSE_AUDIO_BASE_URL
 *   R2_CONCURRENCY            默认 16
 *
 * 用法：
 *   npm run mobile:upload:golden-verse-r2
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bucket = (process.env.R2_BUCKET || "askbible-media").trim();
const concurrency = Math.max(1, Number(process.env.R2_CONCURRENCY || 16) || 16);

const packs = [
  {
    id: "golden-verses",
    dir: path.join(repoRoot, "public", "audio", "golden-verses"),
    prefix: "audio/golden-verses",
  },
  {
    id: "golden-verses-web-en",
    dir: path.join(repoRoot, "public", "audio", "golden-verses-web-en"),
    prefix: "audio/golden-verses-web-en",
  },
];

function wrangler(args, opts = {}) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    ...opts,
  });
  return result;
}

function ensureBucket() {
  const listed = wrangler(["r2", "bucket", "list"]);
  if (listed.status !== 0) {
    const err = `${listed.stderr || ""}${listed.stdout || ""}`;
    if (/enable R2|code: 10042/i.test(err)) {
      console.error(
        "\nR2 尚未开通。请打开 Cloudflare Dashboard → R2 → Purchase / Enable，然后重跑本脚本：\n" +
          "  https://dash.cloudflare.com/?to=/:account/r2\n",
      );
      process.exit(1);
    }
    console.error(err || "wrangler r2 bucket list failed");
    process.exit(1);
  }
  const text = `${listed.stdout || ""}${listed.stderr || ""}`;
  if (!new RegExp(`\\b${bucket}\\b`).test(text)) {
    console.log(`Creating R2 bucket: ${bucket}`);
    const created = wrangler(["r2", "bucket", "create", bucket], { stdio: "inherit" });
    if (created.status !== 0) process.exit(created.status || 1);
  } else {
    console.log(`R2 bucket exists: ${bucket}`);
  }
}

function listMp3(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".mp3"))
    .map((n) => path.join(dir, n));
}

async function mapPool(items, limit, worker) {
  let i = 0;
  let failed = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        await worker(items[idx], idx);
      } catch (err) {
        failed += 1;
        console.error(err);
      }
    }
  });
  await Promise.all(runners);
  return failed;
}

function putObject(localPath, key) {
  return new Promise((resolve, reject) => {
    const child = spawnSync(
      "npx",
      [
        "wrangler",
        "r2",
        "object",
        "put",
        `${bucket}/${key}`,
        "--file",
        localPath,
        "--content-type",
        "audio/mpeg",
        "--remote",
      ],
      { cwd: repoRoot, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    );
    if (child.status === 0) resolve();
    else reject(new Error(child.stderr || child.stdout || `put failed ${key}`));
  });
}

async function uploadPack(pack) {
  const files = listMp3(pack.dir);
  console.log(`${pack.id}: ${files.length} mp3 → r2://${bucket}/${pack.prefix}/`);
  if (files.length === 0) return 0;

  let done = 0;
  const failed = await mapPool(files, concurrency, async (abs) => {
    const name = path.basename(abs);
    const key = `${pack.prefix}/${name}`;
    await putObject(abs, key);
    done += 1;
    if (done % 100 === 0 || done === files.length) {
      console.log(`  ${pack.id}: ${done}/${files.length}`);
    }
  });
  if (failed) console.warn(`  ${pack.id}: ${failed} failed`);
  return failed;
}

async function main() {
  ensureBucket();
  let failedTotal = 0;
  for (const pack of packs) {
    failedTotal += await uploadPack(pack);
  }
  console.log("\nDone (byte-preserving put; no transcode).");
  console.log(
    "Next: Dashboard → R2 → bucket → Settings → Public development URL (r2.dev) → Enable,",
  );
  console.log(
    "then set EXPO_PUBLIC_GOLDEN_VERSE_AUDIO_BASE_URL to that https://pub-….r2.dev base",
  );
  console.log("(no trailing slash). Objects are under /audio/golden-verses/…");
  if (failedTotal) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
