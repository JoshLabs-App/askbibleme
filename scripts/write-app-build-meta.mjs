/**
 * 构建/开发启动前写入 `public/app-build.json`，供静态 CDN 与 `getAppBuildId()` 对齐。
 * - 生产构建：VERCEL_DEPLOYMENT_ID / VERCEL_GIT_COMMIT_SHA / 随机 UUID
 * - `--dev`：固定 `development`（与 AppUpdateNotifier 跳过逻辑一致）
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "public", "app-build.json");

const isDev = process.argv.includes("--dev");

const id = isDev
  ? "development"
  : (
      process.env.VERCEL_DEPLOYMENT_ID?.trim() ||
      process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
      crypto.randomUUID()
    );

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify({ id })}\n`, "utf8");
console.log(`[write-app-build-meta] wrote ${outPath} id=${id}`);
