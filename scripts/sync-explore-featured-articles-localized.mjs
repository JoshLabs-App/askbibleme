#!/usr/bin/env node
/**
 * Bundle explore featured article markdown + meta into JSON for Web cache and mobile.
 * Run: node scripts/sync-explore-featured-articles-localized.mjs
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = path.join(repoRoot, "node_modules/tsx/dist/cli.mjs");
const script = path.join(repoRoot, "scripts/sync-explore-featured-articles-localized.ts");
const result = spawnSync("node", [tsxCli, script], { cwd: repoRoot, stdio: "inherit" });
process.exit(result.status ?? 1);
