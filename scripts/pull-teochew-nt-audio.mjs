#!/usr/bin/env node
/**
 * 按 manifest 将 TSTSCC 朗读版 MP3 下载到 public/audio/teochew-nt/（或 DATA_ROOT/audio/teochew-nt）。
 *
 *   npm run audio:teochew-pull
 *   DATA_ROOT=/var/data npm run audio:teochew-pull
 *   npm run audio:teochew-pull -- --book MAT
 *   npm run audio:teochew-pull -- --limit 5
 */
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const manifestPath = path.join(cwd, "data", "bible", "teochew-nt-audio-manifest.json");

function parseArgs(argv) {
  const out = { book: null, limit: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--book" && argv[i + 1]) {
      out.book = String(argv[++i]).trim().toUpperCase();
    } else if (argv[i] === "--limit" && argv[i + 1]) {
      out.limit = Math.max(1, Number(argv[++i]));
    }
  }
  return out;
}

async function download(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "SelahTeochewPull/1.0" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  if (!fs.existsSync(manifestPath)) {
    console.error(`Missing ${manifestPath}. Run: npm run audio:teochew-manifest`);
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
    ? path.join(root, "audio", "teochew-nt")
    : path.join(cwd, "public", "audio", "teochew-nt");
  fs.mkdirSync(destDir, { recursive: true });

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const e of entries) {
    const dest = path.join(destDir, e.localFilename);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      skip++;
      continue;
    }
    process.stdout.write(`${e.localFilename} … `);
    try {
      const buf = await download(e.remoteUrl);
      fs.writeFileSync(dest, buf);
      console.log(`${(buf.length / 1024 / 1024).toFixed(1)} MB`);
      ok++;
    } catch (err) {
      console.log(`FAIL (${err.message})`);
      fail++;
    }
  }

  console.log(`\nDone → ${destDir}\n  downloaded: ${ok}, skipped: ${skip}, failed: ${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
