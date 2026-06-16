#!/usr/bin/env npx tsx
/** @deprecated Use scripts/sync-legacy-figures-bundles.ts */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "sync-legacy-figures-bundles.ts");
const result = spawnSync("npx", ["tsx", script], { stdio: "inherit", cwd: path.dirname(script) });
process.exit(result.status ?? 1);
