#!/usr/bin/env node
/** Prune theme-repeat-ge5 manifest/chunks to match allowlist (no themes DB needed). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAllowlistTsv } from "./lib/verse-pool-audit-data.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scopeId = "theme-repeat-ge5";
const poolDir = path.join(repoRoot, "public/data/home-prayer-pools", scopeId);
const allowlistPath = path.join(repoRoot, "data/scripture", `${scopeId}-allowlist.tsv`);
const CHUNK_SIZE = 20;

const allowKeys = new Set(
  parseAllowlistTsv(fs.readFileSync(allowlistPath, "utf8")).map((r) => r.verseKey),
);

const manifest = JSON.parse(fs.readFileSync(path.join(poolDir, "manifest.json"), "utf8"));
const allVerses = [];
for (const name of fs.readdirSync(poolDir).sort()) {
  const m = /^chunk-(\d+)\.json$/.exec(name);
  if (!m) continue;
  const chunk = JSON.parse(fs.readFileSync(path.join(poolDir, name), "utf8"));
  for (const v of chunk.verses ?? []) allVerses.push(v);
}

const before = allVerses.length;
const kept = allVerses.filter((v) => allowKeys.has(String(v.verseKey).toUpperCase()));
const removed = before - kept.length;

const entries = kept.map((v, i) => ({
  verseKey: v.verseKey,
  weight: v.weight ?? 1,
  chunkIndex: Math.floor(i / CHUNK_SIZE),
}));

const newManifest = {
  ...manifest,
  entries,
  bootstrapVerseKeys: entries.slice(0, 40).map((e) => e.verseKey),
};

fs.writeFileSync(path.join(poolDir, "manifest.json"), `${JSON.stringify(newManifest)}\n`, "utf8");

const chunkCount = entries.length ? Math.ceil(entries.length / CHUNK_SIZE) : 0;
for (let ci = 0; ci < chunkCount; ci++) {
  const slice = kept.slice(ci * CHUNK_SIZE, ci * CHUNK_SIZE + CHUNK_SIZE);
  const chunk = { version: 1, scopeId, chunkIndex: ci, verses: slice };
  fs.writeFileSync(path.join(poolDir, `chunk-${ci}.json`), `${JSON.stringify(chunk)}\n`, "utf8");
}

for (const name of fs.readdirSync(poolDir)) {
  const m = /^chunk-(\d+)\.json$/.exec(name);
  if (m && Number(m[1]) >= chunkCount) fs.unlinkSync(path.join(poolDir, name));
}

console.log(`[prune-theme-repeat-pool] ${before} -> ${kept.length} verses (removed ${removed}), ${chunkCount} chunks`);
