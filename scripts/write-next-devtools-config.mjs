/**
 * Next.js 15+ 在 dev 里会挂载带黑色「N」的 DevTools 浮标（nextjs-portal）。
 * `next.config` 的 `devIndicators: false` 不会关掉该浮标；需在 `.next/cache/next-devtools-config.json`
 * 里设置 `disableDevIndicator: true`。在每次 `next dev` 前运行本脚本，保证本地开发一致关闭。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, ".next", "cache");
const file = path.join(dir, "next-devtools-config.json");

fs.mkdirSync(dir, { recursive: true });
let prev = {};
if (fs.existsSync(file)) {
  try {
    prev = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    prev = {};
  }
}
const next = { ...prev, disableDevIndicator: true };
fs.writeFileSync(file, JSON.stringify(next, null, 2));
