#!/usr/bin/env node
/**
 * Resume-friendly R2 upload via Cloudflare REST API (byte-preserving).
 * Lists existing keys once, then uploads only missing files with 429 backoff.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const accountId = "652050e08d4a384c7cbe975ea02fb52c";
const bucket = process.env.R2_BUCKET || "askbible-media";
const concurrency = Math.max(1, Number(process.env.R2_CONCURRENCY || 6) || 6);
const publicBase =
  process.env.R2_PUBLIC_BASE_URL ||
  "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev";

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

function readWranglerOAuthToken() {
  const cfg = path.join(os.homedir(), ".wrangler", "config", "default.toml");
  const text = fs.readFileSync(cfg, "utf8");
  const m = text.match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!m) throw new Error(`oauth_token missing in ${cfg}`);
  return m[1];
}

function listMp3(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".mp3"))
    .map((n) => path.join(dir, n));
}

function objectUrl(key) {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
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
        if (failed <= 40) console.error(String(err?.message || err));
      }
    }
  });
  await Promise.all(runners);
  return failed;
}

async function listExistingKeys(token, prefix) {
  const keys = new Set();
  let cursor = "";
  for (;;) {
    const qs = new URLSearchParams({ per_page: "1000", prefix });
    if (cursor) qs.set("cursor", cursor);
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects?${qs}`;
    let attempt = 0;
    let json;
    for (;;) {
      attempt += 1;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      json = await res.json().catch(() => ({}));
      if (res.ok && json.success) break;
      const code = json?.errors?.[0]?.code;
      if ((res.status === 429 || code === 971 || res.status >= 500) && attempt < 12) {
        const wait = Math.min(120_000, 2000 * 2 ** Math.min(attempt, 6));
        console.warn(`  list throttle; wait ${Math.round(wait / 1000)}s (try ${attempt})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw new Error(`list ${prefix}: ${res.status} ${JSON.stringify(json.errors || json)}`);
    }
    for (const row of json.result || []) {
      if (row?.key) keys.add(row.key);
    }
    const info = json.result_info || {};
    if (!info.is_truncated || !info.cursor) break;
    cursor = info.cursor;
    await new Promise((r) => setTimeout(r, 200));
  }
  return keys;
}

async function putObject(token, absPath, key) {
  const body = fs.readFileSync(absPath);
  let attempt = 0;
  for (;;) {
    attempt += 1;
    const res = await fetch(objectUrl(key), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "audio/mpeg",
      },
      body,
    });
    if (res.ok) return;
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 16) {
      const wait = Math.min(90_000, 1000 * 2 ** Math.min(attempt, 6));
      if (attempt <= 3 || attempt % 3 === 0) {
        console.warn(`  throttle ${res.status} on ${path.basename(key)}; wait ${Math.round(wait / 1000)}s (try ${attempt})`);
      }
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`PUT ${key} → ${res.status} ${text.slice(0, 180)}`);
  }
}

async function uploadPack(token, pack) {
  const files = listMp3(pack.dir);
  console.log(`${pack.id}: ${files.length} local; listing remote…`);
  const existing = await listExistingKeys(token, `${pack.prefix}/`);
  console.log(`${pack.id}: ${existing.size} already on R2`);

  const pending = files.filter((abs) => !existing.has(`${pack.prefix}/${path.basename(abs)}`));
  console.log(`${pack.id}: ${pending.length} to upload (concurrency=${concurrency})`);
  if (!pending.length) return 0;

  let done = 0;
  const t0 = Date.now();
  const failed = await mapPool(pending, concurrency, async (abs) => {
    const key = `${pack.prefix}/${path.basename(abs)}`;
    await putObject(token, abs, key);
    done += 1;
    if (done % 50 === 0 || done === pending.length) {
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  ${pack.id}: uploaded ${done}/${pending.length} (${sec}s)`);
    }
  });
  if (failed) console.warn(`  ${pack.id}: ${failed} failed`);
  return failed;
}

async function main() {
  const token = readWranglerOAuthToken();
  console.log(`bucket=${bucket} concurrency=${concurrency}`);
  console.log(`publicBase=${publicBase}`);
  let failed = 0;
  for (const pack of packs) failed += await uploadPack(token, pack);
  console.log("\nUpload finished (no transcode).");
  console.log(`EXPO_PUBLIC_GOLDEN_VERSE_AUDIO_BASE_URL=${publicBase}`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
