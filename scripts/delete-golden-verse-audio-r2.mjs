#!/usr/bin/env node
/**
 * Delete golden-verse audio objects from R2 for verses removed from allowlist.
 *
 *   node scripts/delete-golden-verse-audio-r2.mjs
 *   node scripts/delete-golden-verse-audio-r2.mjs --verse PSA.137.9
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { parseAllowlistTsv, verseKeyToAudioFilenames } from "./lib/verse-pool-audit-data.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bucket = process.env.R2_BUCKET || "askbible-media";
const concurrency = Math.max(1, Number(process.env.R2_CONCURRENCY || 4) || 4);

function readArg(name) {
  const prefix = `--${name}=`;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith(prefix)) return a.slice(prefix.length).trim();
  }
  return undefined;
}

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

function removedVerseKeysFromBackup() {
  const allowlistPath = path.join(repoRoot, "data/scripture/theme-repeat-ge5-allowlist.tsv");
  const backupDir = path.join(repoRoot, "data/scripture");
  const backups = fs
    .readdirSync(backupDir)
    .filter((n) => n.startsWith("theme-repeat-ge5-allowlist.tsv.bak-"))
    .map((n) => ({ n, t: Number(n.split(".bak-")[1] || 0) }))
    .sort((a, b) => b.t - a.t);
  if (!backups.length) throw new Error("No allowlist backup found");
  const backupPath = path.join(backupDir, backups[0].n);
  const before = parseAllowlistTsv(fs.readFileSync(backupPath, "utf8"));
  const after = parseAllowlistTsv(fs.readFileSync(allowlistPath, "utf8"));
  const afterKeys = new Set(after.map((r) => r.verseKey));
  return before.filter((r) => !afterKeys.has(r.verseKey)).map((r) => r.verseKey);
}

function keysForVerse(verseKey) {
  return verseKeyToAudioFilenames(verseKey).map((rel) => `audio/${rel}`);
}

async function mapPool(items, limit, worker) {
  let i = 0;
  let failed = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
      while (i < items.length) {
        const idx = i++;
        try {
          await worker(items[idx], idx);
        } catch (err) {
          failed += 1;
          if (failed <= 40) console.error(String(err?.message || err));
        }
      }
    }),
  );
  return failed;
}

async function deleteObject(key) {
  const objectPath = `${bucket}/${key}`;
  try {
    await execFileAsync(
      "npx",
      ["wrangler", "r2", "object", "delete", objectPath, "--remote", "-y"],
      { cwd: repoRoot, maxBuffer: 4 * 1024 * 1024 },
    );
    return "deleted";
  } catch (err) {
    const msg = String(err.stderr || err.stdout || err.message || err);
    if (/not found|does not exist|404/i.test(msg)) return "missing";
    throw new Error(`DELETE ${key}: ${msg.slice(0, 240)}`);
  }
}

async function main() {
  const dryRun = hasFlag("dry-run");
  const single = readArg("verse");

  const verseKeys = single
    ? [single.trim().toUpperCase()]
    : removedVerseKeysFromBackup();

  const objectKeys = [...new Set(verseKeys.flatMap(keysForVerse))];
  console.log(`bucket=${bucket} verses=${verseKeys.length} objects=${objectKeys.length} dryRun=${dryRun}`);

  if (dryRun) {
    for (const k of objectKeys) console.log(`  would delete ${k}`);
    return;
  }

  let deleted = 0;
  let missing = 0;
  const failed = await mapPool(objectKeys, concurrency, async (key) => {
    const result = await deleteObject(key);
    if (result === "deleted") deleted += 1;
    else missing += 1;
    if ((deleted + missing) % 20 === 0 || deleted + missing === objectKeys.length) {
      console.log(`  progress ${deleted + missing}/${objectKeys.length} (deleted=${deleted}, missing=${missing})`);
    }
  });

  console.log(`\nR2 delete finished: deleted=${deleted}, missing=${missing}, failed=${failed}`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
