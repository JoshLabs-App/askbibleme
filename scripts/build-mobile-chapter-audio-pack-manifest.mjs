#!/usr/bin/env node
/**
 * 圣经章朗读音频：单独资源包 manifest（供 askbible.me 分发；不进 App / EAS 归档）。
 * 源文件在 public/audio/；App 按需从 /api/mobile/resource-pack/chapter-audio/manifest 拉清单后下载。
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicAudioRoot = path.join(repoRoot, "public", "audio");
const outDir = path.join(repoRoot, "data", "mobile-offline-packs", "chapter-audio");
const outManifest = path.join(outDir, "manifest.json");

const SCOPES = ["cuv-v20", "web-en", "blm-es", "teochew-nt"];

function normalizeRelUrl(scope, fileName) {
  return `/audio/${scope}/${fileName}`;
}

async function md5File(absPath) {
  return await new Promise((resolve, reject) => {
    const hash = createHash("md5");
    const stream = fs.createReadStream(absPath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function collectScope(scope) {
  const dir = path.join(publicAudioRoot, scope);
  if (!fs.existsSync(dir)) return [];
  const assets = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".mp3")) continue;
    const abs = path.join(dir, name);
    const stat = await fsp.stat(abs);
    if (!stat.isFile() || stat.size <= 0) continue;
    const urlPath = normalizeRelUrl(scope, name);
    assets.push({
      scope,
      path: urlPath,
      size: stat.size,
      md5: await md5File(abs),
    });
  }
  return assets.sort((a, b) => a.path.localeCompare(b.path));
}

async function main() {
  const all = [];
  for (const scope of SCOPES) {
    const rows = await collectScope(scope);
    all.push(...rows);
    console.log(`  ${scope}: ${rows.length} mp3`);
  }

  const hash = createHash("md5");
  for (const row of all) {
    hash.update(row.path);
    hash.update("|");
    hash.update(String(row.size));
    hash.update("|");
    hash.update(row.md5);
    hash.update("\n");
  }
  const packVersion = `chapter-audio-v1-${hash.digest("hex").slice(0, 16)}`;

  const manifest = {
    packType: "chapter-audio",
    packVersion,
    assets: all,
    generatedAt: new Date().toISOString(),
  };

  await fsp.mkdir(outDir, { recursive: true });
  await fsp.writeFile(outManifest, `${JSON.stringify(manifest, null, 2)}\n`);
  const mb = (JSON.stringify(manifest).length / (1024 * 1024)).toFixed(2);
  console.log(`Wrote ${path.relative(repoRoot, outManifest)} (${all.length} assets, manifest ~${mb} MB)`);
  console.log(`packVersion=${packVersion}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
