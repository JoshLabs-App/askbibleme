#!/usr/bin/env node
/**
 * 从 AskBible 2 复制 verse-timings JSON 到 Selah public/verse-timings。
 *
 *   npm run audio:verse-timings-sync
 *   ASKBIBLE_REPO=/path/to/askbible npm run audio:verse-timings-sync
 */
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const askRoot =
  process.env.ASKBIBLE_REPO?.trim() ||
  path.join(process.env.HOME || "", "Desktop", "APP", "01 AskBible 2");
const src = path.join(askRoot, "apps", "web", "public", "verse-timings");
const dest = path.join(cwd, "public", "verse-timings");

if (!fs.existsSync(src)) {
  console.error(`Source not found: ${src}`);
  console.error("Set ASKBIBLE_REPO to AskBible 2 root, or install timings under public/verse-timings/");
  process.exit(1);
}

const files = fs.readdirSync(src).filter((n) => /^[A-Z0-9]{2,8}-\d+\.json$/i.test(n));
if (files.length === 0) {
  console.error(`No timing JSON in ${src}`);
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });
let copied = 0;
for (const name of files) {
  fs.copyFileSync(path.join(src, name), path.join(dest, name));
  copied++;
}

console.log(`Copied ${copied} files → ${dest}`);
