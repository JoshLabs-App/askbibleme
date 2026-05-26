#!/usr/bin/env node
/**
 * @deprecated 请用 npm run nature:backfill-preview-frames 或 nature:regenerate-preview-4k
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.includes("--force") ? ["--force"] : [];
const r = spawnSync("npx", ["tsx", "scripts/regenerate-nature-preview-frames.ts", ...args], {
  cwd,
  stdio: "inherit",
});
process.exit(r.status ?? 1);
