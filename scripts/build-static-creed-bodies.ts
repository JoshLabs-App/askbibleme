#!/usr/bin/env node
/**
 * 把五篇长信经正文生成为静态 JSON：public/data/historical-creeds/{id}.json
 * 网页打开全文时再取（见 lib/explore/historical-creeds-body-load-web.ts）。产物不入库，由 prebuild 生成。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAZY_HISTORICAL_CREED_BODIES } from "../lib/explore/historical-creeds-bodies/lazy-bodies";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "public", "data", "historical-creeds");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

let total = 0;
for (const [id, body] of Object.entries(LAZY_HISTORICAL_CREED_BODIES)) {
  if (!Array.isArray(body.bodyZh) || !Array.isArray(body.bodyZhTw) || !Array.isArray(body.bodyEn)) {
    throw new Error(`信经正文结构不对：${id}`);
  }
  const json = JSON.stringify({ bodyZh: body.bodyZh, bodyZhTw: body.bodyZhTw, bodyEn: body.bodyEn });
  fs.writeFileSync(path.join(outDir, `${id}.json`), json, "utf8");
  total += Buffer.byteLength(json);
}
console.log(`静态信经正文：${Object.keys(LAZY_HISTORICAL_CREED_BODIES).length} 个文件，${(total / 1048576).toFixed(2)} MB → public/data/historical-creeds/`);
