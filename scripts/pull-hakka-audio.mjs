#!/usr/bin/env node
/**
 * 按 manifest 下载 MP3 到 public/audio/hakka（或 DATA_ROOT/audio/hakka）。
 *
 *   npm run audio:hakka-pull
 *   npm run audio:hakka-pull -- --book MAT
 *   npm run audio:hakka-pull -- --limit 10
 *   node scripts/pull-hakka-audio.mjs --manifest data/bible/cantonese-v3-audio-manifest.json --dest-subdir cantonese-v3
 */
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
function parseArgs(argv) {
  const out = {
    book: null,
    limit: null,
    manifest: path.join("data", "bible", "hakka-audio-manifest.json"),
    destSubdir: "hakka",
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--book" && argv[i + 1]) {
      out.book = String(argv[++i]).trim().toUpperCase();
    } else if (argv[i] === "--limit" && argv[i + 1]) {
      out.limit = Math.max(1, Number(argv[++i]));
    } else if (argv[i] === "--manifest" && argv[i + 1]) {
      out.manifest = String(argv[++i]).trim();
    } else if (argv[i] === "--dest-subdir" && argv[i + 1]) {
      out.destSubdir = String(argv[++i]).trim();
    }
  }
  return out;
}

async function download(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "AskBibleHakkaPull/1.0" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const { book, limit, manifest: manifestArg, destSubdir } = parseArgs(process.argv.slice(2));
  const manifestPath = path.isAbsolute(manifestArg) ? manifestArg : path.join(cwd, manifestArg);
  if (!fs.existsSync(manifestPath)) {
    console.error(`Missing ${manifestPath}. Run: npm run audio:hakka-manifest`);
    process.exit(1);
  }

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
    ? path.join(root, "audio", destSubdir)
    : path.join(cwd, "public", "audio", destSubdir);
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
      if (buf.length < 1024) throw new Error(`file too small (${buf.length} bytes)`);
      fs.writeFileSync(dest, buf);
      console.log(`${(buf.length / 1024 / 1024).toFixed(1)} MB`);
      ok++;
    } catch (err) {
      console.log(`FAIL (${err instanceof Error ? err.message : err})`);
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
