#!/usr/bin/env node
/**
 * Promote version to closed testing (alpha) + print Play Console steps for testers.
 * Countries on alpha are configured in Play Console (Countries / regions tab).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const versionCode = process.argv[2];
if (!versionCode) {
  console.error("Usage: node scripts/setup-android-closed-test-track.mjs <versionCode>");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const promote = spawnSync("node", ["scripts/promote-android-play-track.mjs", versionCode, "alpha"], {
  cwd: root,
  stdio: "inherit",
});
if (promote.status !== 0) process.exit(promote.status ?? 1);

console.log("");
console.log("Play Console 还需手动一次（API 无法配置测试员邮箱）：");
console.log("  Testing → Closed testing → Alpha → Testers");
console.log("  1. Create email list → 添加 Gmail 测试账号");
console.log("  2. 勾选该列表 → Save");
console.log("  3. 复制加入链接：https://play.google.com/apps/testing/me.askbible");
console.log("");
console.log("若你在自定义轨道（如 623）发布，还需 Countries / regions：");
console.log("  关闭 Sync with production → 至少选 1 国（如 Pakistan）→ Save");
