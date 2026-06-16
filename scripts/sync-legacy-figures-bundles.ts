#!/usr/bin/env npx tsx
/**
 * Precompute static figure timeline bundles for Web + App.
 * Run after changing legacy-figure-preview.json or sort rules:
 *   npx tsx scripts/sync-legacy-figures-bundles.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import type { LegacyFigureEnProfileBlock } from "../lib/legacy-figure-articles-en-bundle";
import { buildLegacyFiguresTimelineBundle } from "../lib/build-legacy-figures-timeline-bundle";
import { buildLegacyFiguresForBookTable } from "../lib/legacy-figure-preview";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnById(): Map<string, LegacyFigureEnProfileBlock> {
  const bundlePath = path.join(repoRoot, "data", "legacy-figure-articles", "bundle.json");
  try {
    const raw = JSON.parse(fs.readFileSync(bundlePath, "utf8")) as {
      profiles?: Array<{ id: string; en: LegacyFigureEnProfileBlock }>;
    };
    return new Map((raw.profiles ?? []).map((entry) => [entry.id, entry.en]));
  } catch {
    return new Map();
  }
}

const timelineBundle = buildLegacyFiguresTimelineBundle(repoRoot);
const timelineOut = path.join(repoRoot, "data", "legacy-figures-timeline.json");
fs.writeFileSync(timelineOut, `${JSON.stringify(timelineBundle, null, 2)}\n`);
console.log(
  `Wrote ${timelineOut} (${timelineBundle.bookRows.length} book rows, ${(fs.statSync(timelineOut).size / 1024).toFixed(0)} KB)`,
);

const enById = readEnById();
const profiles = buildLegacyFiguresForBookTable(repoRoot).map((profile) => ({
  ...profile,
  en: enById.get(profile.id) ?? null,
}));
const bookRows = timelineBundle.bookRows.map((row) => ({
  ...row,
  figures: row.figures.map((entry) => ({
    ...entry,
    article: null as null,
  })),
}));

const mobileBundle = {
  schemaVersion: 2,
  contentVersion: createHash("sha256")
    .update(JSON.stringify({ schemaVersion: 2, profiles, bookRows }))
    .digest("hex")
    .slice(0, 16),
  profiles,
  bookRows,
};
const mobileOut = path.join(repoRoot, "apps/askbible-mobile/src/legacy-figures/mobile-legacy-figures.json");
const apiOut = path.join(repoRoot, "data/legacy-figures-mobile.json");
fs.mkdirSync(path.dirname(mobileOut), { recursive: true });
const mobileJson = `${JSON.stringify(mobileBundle)}\n`;
fs.writeFileSync(mobileOut, mobileJson);
fs.writeFileSync(apiOut, mobileJson);
console.log(
  `Wrote ${mobileOut} (${profiles.length} profiles, ${bookRows.length} book rows, ${(fs.statSync(mobileOut).size / 1024).toFixed(0)} KB)`,
);
console.log(`Wrote ${apiOut}`);
