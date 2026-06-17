#!/usr/bin/env npx tsx
/** 确保 Mobile 本地副本与 lib 真源的人物馆英文 locale 逻辑一致。 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const libPath = path.join(repoRoot, "lib/legacy-figure-english-display-name.ts");
const mobilePath = path.join(
  repoRoot,
  "apps/askbible-mobile/src/legacy-figures/legacyFigureEnglishDisplayName.ts",
);

function bodyWithoutSyncComment(src: string): string {
  return src
    .replace(/^\/\*\*[\s\S]*?\*\/\s*/m, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function normalizeForCompare(src: string): string {
  return bodyWithoutSyncComment(src)
    .replace(/export function containsHanText/g, "export function legacyFigureContainsHanText")
    .replace(/containsHanText\(/g, "legacyFigureContainsHanText(");
}

const lib = fs.readFileSync(libPath, "utf8");
const mobile = fs.readFileSync(mobilePath, "utf8");

if (normalizeForCompare(lib) !== normalizeForCompare(mobile)) {
  console.error("legacy figure english display name drift:");
  console.error(`  lib:    ${libPath}`);
  console.error(`  mobile: ${mobilePath}`);
  console.error("Sync mobile copy from lib (keep Metro-local file, update contents).");
  process.exit(1);
}

console.log("legacy figure english display name: lib ↔ mobile in sync");
