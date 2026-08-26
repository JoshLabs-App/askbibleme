#!/usr/bin/env node
/**
 * Upload music companion mp3s to R2 via wrangler CLI (byte-preserving).
 * Keys match companion `src`: public/music/uploads/….mp3 → music/uploads/….mp3
 *
 * Uses `wrangler r2 object put --remote` (OAuth); skips keys already reachable on public base.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bucket = process.env.R2_BUCKET || "askbible-media";
const concurrency = Math.max(1, Number(process.env.R2_CONCURRENCY || 2) || 2);
const publicBase =
  process.env.R2_PUBLIC_BASE_URL ||
  "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev";
const uploadsDir = path.join(repoRoot, "public", "music", "uploads");
const prefix = "music/uploads";

function listMp3(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".mp3") || n.endsWith(".m4a"))
    .map((n) => path.join(dir, n));
}

async function remoteExists(key) {
  try {
    const res = await fetch(`${publicBase}/${key}`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

function putWithWrangler(absPath, key, contentType = "audio/mpeg", extraArgs = []) {
  const result = spawnSync(
    "npx",
    [
      "wrangler",
      "r2",
      "object",
      "put",
      `${bucket}/${key}`,
      `--file=${absPath}`,
      `--content-type=${contentType}`,
      ...extraArgs,
      "--remote",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(
      `wrangler put failed ${key}: ${(result.stderr || result.stdout || "").slice(0, 300)}`,
    );
  }
}

async function mapPool(items, limit, worker) {
  let i = 0;
  let failed = 0;
  const runners = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        await worker(items[idx], idx);
      } catch (err) {
        failed += 1;
        console.error(String(err?.message || err));
      }
    }
  });
  await Promise.all(runners);
  return failed;
}

async function main() {
  console.log(`bucket=${bucket} concurrency=${concurrency}`);
  console.log(`publicBase=${publicBase}`);
  const files = listMp3(uploadsDir);
  console.log(`local files: ${files.length}`);
  const pending = [];
  for (const abs of files) {
    const key = `${prefix}/${path.basename(abs)}`;
    if (await remoteExists(key)) {
      console.log(`  skip exists ${key}`);
      continue;
    }
    const contentType = abs.endsWith(".m4a") ? "audio/mp4" : "audio/mpeg";
    pending.push({ abs, key, contentType });
  }
  console.log(`to upload: ${pending.length}`);
  let done = 0;
  const t0 = Date.now();
  const failed = await mapPool(pending, concurrency, async ({ abs, key, contentType }) => {
    putWithWrangler(abs, key, contentType);
    done += 1;
    console.log(
      `  uploaded ${done}/${pending.length} ${path.basename(key)} (${((Date.now() - t0) / 1000).toFixed(0)}s)`,
    );
  });
  const catalogPath = path.join(repoRoot, "data", "music-companion.json");
  const catalogRaw = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const audioTracks = (catalogRaw.audioTracks || []).filter((t) => t && t.hidden !== true);
  const visibleIds = new Set(audioTracks.map((t) => String(t.id || "").trim()).filter(Boolean));
  const catalog = {
    ...catalogRaw,
    audioTracks,
    scenes: (catalogRaw.scenes || []).map((scene) => ({
      ...scene,
      audioTrackId:
        scene.audioTrackId && visibleIds.has(scene.audioTrackId) ? scene.audioTrackId : null,
    })),
  };
  const catalogTmp = path.join(repoRoot, "tmp", "music-companion.r2.json");
  fs.mkdirSync(path.dirname(catalogTmp), { recursive: true });
  fs.writeFileSync(catalogTmp, `${JSON.stringify(catalog)}\n`);
  putWithWrangler(catalogTmp, "music/companion.json", "application/json", [
    "--cache-control=public, max-age=60",
  ]);
  console.log("  uploaded music/companion.json");

  console.log("\nUpload finished (no transcode).");
  console.log(`EXPO_PUBLIC_MUSIC_AUDIO_BASE_URL=${publicBase}`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
