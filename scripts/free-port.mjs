#!/usr/bin/env node
/**
 * 释放本机某个端口上的进程（macOS / Linux：用 lsof）。
 * Windows 无 lsof，会提示手动关闭占用端口的程序。
 *
 * 用法：node scripts/free-port.mjs 3450
 */
import { execSync } from "node:child_process";
import process from "node:process";

const port = process.argv[2] ?? "3450";

if (process.platform === "win32") {
  console.log(
    "[free-port] Windows：请手动结束占用端口 %s 的程序（例如任务管理器里的 node.exe）。",
    port,
  );
  process.exit(0);
}

try {
  const raw = execSync(`lsof -ti:${port}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
  const pids = raw.split(/\s+/).filter(Boolean);
  if (pids.length === 0) {
    console.log(`[free-port] 端口 ${port} 未被占用。`);
    process.exit(0);
  }
  for (const p of pids) {
    try {
      process.kill(Number(p), "SIGTERM");
      console.log(`[free-port] 已发送结束信号 → 进程 ${p}（端口 ${port}）`);
    } catch {
      /* ignore */
    }
  }
} catch {
  console.log(`[free-port] 端口 ${port} 未被占用（或无法检测）。`);
}
