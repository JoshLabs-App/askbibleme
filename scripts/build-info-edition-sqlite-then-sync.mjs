#!/usr/bin/env node
/** 生成 info-edition sqlite 再同步进 App 资源；供 npm run mobile:sync-info-edition 调用。 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const steps = [
  ["npx", ["tsx", "--tsconfig", "scripts/tsconfig.config-build.json", "scripts/build-info-edition-sqlite.ts"]],
  ["node", ["scripts/sync-mobile-info-edition-sqlite.mjs"]],
];
for (const [cmd, args] of steps) {
  const r = spawnSync(cmd, args, { cwd: repoRoot, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
