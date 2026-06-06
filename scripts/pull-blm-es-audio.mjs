#!/usr/bin/env node
/**
 * 按 manifest 拉取 BLM 西语整章 MP3 到 public/audio/blm-es（或 DATA_ROOT/audio/blm-es）。
 *
 * 用法：
 *   npm run audio:blm-es-manifest
 *   npm run audio:blm-es-pull
 *   npm run audio:blm-es-pull -- --book MAT
 *   npm run audio:blm-es-pull -- --limit 5
 */
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const manifestPath = path.join(cwd, "data", "bible", "blm-es-chapter-audio-manifest.json");

function parseArgs(argv) {
  const out = { book: null, limit: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--book" && argv[i + 1]) {
      out.book = String(argv[i + 1]).trim().toUpperCase();
      i += 1;
      continue;
    }
    if (argv[i] === "--limit" && argv[i + 1]) {
      out.limit = Math.max(1, Number(argv[i + 1]));
      i += 1;
    }
  }
  return out;
}

async function download(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "AskBibleBlmEsPull/1.0" },
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  if (!fs.existsSync(manifestPath)) {
    console.error(`Missing ${manifestPath}. Run: npm run audio:blm-es-manifest`);
    process.exit(1);
  }
  const { book, limit } = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  let entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  if (book) entries = entries.filter((e) => e.bookId === book);
  if (limit) entries = entries.slice(0, limit);
  if (entries.length === 0) {
    console.log("No entries to download.");
    process.exit(0);
  }

  const root = process.env.DATA_ROOT?.trim() || process.env.CUV_AUDIO_DATA_DIR?.trim();
  const destDir = root
    ? path.join(root, "audio", "blm-es")
    : path.join(cwd, "public", "audio", "blm-es");
  fs.mkdirSync(destDir, { recursive: true });

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const e of entries) {
    const dest = path.join(destDir, e.localFilename);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      skip += 1;
      continue;
    }
    process.stdout.write(`${e.localFilename} … `);
    try {
      const buf = await download(e.remoteUrl);
      fs.writeFileSync(dest, buf);
      console.log(`${(buf.length / 1024 / 1024).toFixed(1)} MB`);
      ok += 1;
    } catch (err) {
      console.log(`FAIL (${err.message})`);
      fail += 1;
    }
  }

  console.log(`\nDone → ${destDir} (downloaded=${ok}, skipped=${skip}, failed=${fail})`);
  if (fail > 0) process.exit(1);
}

main();
