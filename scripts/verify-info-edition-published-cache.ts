/**
 * 快速验证 info-edition-v1-published 进程内缓存：第二次读取应明显更快。
 * 用法：npx tsx scripts/verify-info-edition-published-cache.ts
 */
import { performance } from "node:perf_hooks";
import {
  invalidateInfoEditionV1PublishedCache,
  readInfoEditionV1PublishedSync,
} from "../lib/bible/info-edition-v1-published-store";

const cwd = process.cwd();

invalidateInfoEditionV1PublishedCache();

const t1 = performance.now();
const a = readInfoEditionV1PublishedSync(cwd);
const coldMs = performance.now() - t1;

const t2 = performance.now();
const b = readInfoEditionV1PublishedSync(cwd);
const warmMs = performance.now() - t2;

const chapterCount = Object.keys(a.chapters).length;
const sameRef = a === b;

console.log("[verify] chapters:", chapterCount);
console.log("[verify] cold read:", coldMs.toFixed(1), "ms");
console.log("[verify] warm read:", warmMs.toFixed(1), "ms");
console.log("[verify] same object ref:", sameRef);

if (!sameRef || warmMs >= coldMs * 0.5) {
  console.error("[verify] FAIL: cache may not be working");
  process.exit(1);
}
console.log("[verify] OK");
