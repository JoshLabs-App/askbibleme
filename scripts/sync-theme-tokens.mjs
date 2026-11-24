#!/usr/bin/env node
/**
 * 从唯一色彩真源 `lib/theme-palette.ts` 同步或校验 `app/tokens.css`。
 * 用法：
 *   node node_modules/tsx/dist/cli.mjs scripts/sync-theme-tokens.mjs
 *   node node_modules/tsx/dist/cli.mjs scripts/sync-theme-tokens.mjs --check
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTokensCss } from "../lib/theme-palette.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = resolve(root, "app/tokens.css");
const expected = renderTokensCss();

if (process.argv.includes("--check")) {
  const actual = existsSync(outPath) ? readFileSync(outPath, "utf8") : "";
  if (actual !== expected) {
    console.error("❌ app/tokens.css 与 lib/theme-palette.ts 未同步，请运行: npm run sync:theme");
    process.exit(1);
  }
  console.log("✅ app/tokens.css 与单一系统色彩总表一致");
  process.exit(0);
}

writeFileSync(outPath, expected, "utf8");
console.log("✅ 已从 lib/theme-palette.ts 生成 app/tokens.css");
