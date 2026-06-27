#!/usr/bin/env node
/**
 * 模拟器开发：强制拉最新 Metro bundle（比单纯 ⌘R 可靠）。
 *
 * 用法：
 *   node scripts/launchers/refresh-mobile-ios-sim.mjs          # 软刷新：Metro /reload + 重启 App
 *   node scripts/launchers/refresh-mobile-ios-sim.mjs --full   # 硬刷新：重启 Metro (--clear) + 重启 App
 *
 * 可选环境变量：
 *   SIM_ID=...           指定模拟器 UDID（默认取第一个 booted）
 *   DEEP_LINK=askbible://explore/reading-planner  启动后打开的页面
 */
import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const MOBILE = path.join(ROOT, "apps/askbible-mobile");
const BUNDLE_ID = "me.askbible";
const METRO_PORT = 8081;
const METRO_LOG = path.join(process.env.TMPDIR || "/tmp", "askbible-metro-reload.log");
const DEV_CLIENT_URL =
  "me.askbible://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081";
const DEEP_LINK = process.env.DEEP_LINK ?? "";

const fullRefresh = process.argv.includes("--full");

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...opts,
  }).trim();
}

function sleep(seconds) {
  execSync(`sleep ${seconds}`);
}

function metroReady() {
  try {
    sh(`curl -sf -o /dev/null http://127.0.0.1:${METRO_PORT}/status`);
    return true;
  } catch {
    return false;
  }
}

function waitForMetro(maxSeconds = 90) {
  for (let i = 0; i < maxSeconds; i += 1) {
    if (metroReady()) {
      return true;
    }
    sleep(1);
  }
  return false;
}

function bootedSimId() {
  if (process.env.SIM_ID?.trim()) {
    return process.env.SIM_ID.trim();
  }
  try {
    const json = sh("xcrun simctl list devices booted -j");
    const parsed = JSON.parse(json);
    for (const runtime of Object.values(parsed.devices)) {
      for (const device of runtime) {
        if (device.state === "Booted") {
          return device.udid;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return "";
}

function clearMetroCaches() {
  for (const target of [path.join(MOBILE, ".expo"), path.join(MOBILE, "node_modules", ".cache")]) {
    if (!existsSync(target)) continue;
    try {
      sh(`rm -rf "${target}"`);
      console.log(`→ 已删除 ${target}`);
    } catch {
      /* ignore */
    }
  }
}

function killMetro() {
  try {
    sh(`node "${ROOT}/scripts/free-port.mjs" ${METRO_PORT}`);
  } catch {
    /* ignore */
  }
  sleep(1);
}

function startMetro() {
  spawn(
    "bash",
    [
      "-lc",
      `cd "${MOBILE}" && REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 npx expo start --port ${METRO_PORT} --localhost --clear --reset-cache >>"${METRO_LOG}" 2>&1`,
    ],
    { detached: true, stdio: "ignore" },
  ).unref();
  console.log("→ Metro 已在后台启动 (--localhost --clear)");
  console.log(`  日志: tail -f ${METRO_LOG}`);
}

function restartApp(simId) {
  try {
    sh(`xcrun simctl terminate "${simId}" ${BUNDLE_ID} 2>/dev/null || true`);
  } catch {
    /* ignore */
  }
  sleep(1);
  try {
    sh(
      `xcrun simctl launch "${simId}" ${BUNDLE_ID} --url "${DEV_CLIENT_URL}" 2>/dev/null || xcrun simctl launch "${simId}" ${BUNDLE_ID}`,
    );
  } catch (error) {
    console.error("✗ 无法启动模拟器 App。请确认已用 Debug 构建安装到模拟器。");
    console.error(String(error.stderr || error.message || error));
    process.exit(1);
  }
  sleep(3);
  try {
    sh(`curl -sf "http://127.0.0.1:${METRO_PORT}/reload"`);
    console.log("→ 已向 Metro 发送 /reload");
  } catch {
    console.log("⚠ Metro /reload 未响应（App 仍会尝试连 127.0.0.1:8081）");
  }
  if (DEEP_LINK) {
    sleep(1);
    try {
      sh(`xcrun simctl openurl "${simId}" "${DEEP_LINK}"`);
      console.log(`→ 已打开 ${DEEP_LINK}`);
    } catch {
      /* ignore */
    }
  }
}

function main() {
  if (!existsSync(MOBILE)) {
    console.error(`✗ 找不到 ${MOBILE}`);
    process.exit(1);
  }

  const simId = bootedSimId();
  if (!simId) {
    console.error("✗ 没有已启动的 iOS 模拟器。请先打开 Simulator 并运行 App。");
    process.exit(1);
  }

  console.log(`AskBible.me · iOS 模拟器刷新 (${fullRefresh ? "硬" : "软"})`);
  console.log(`  模拟器: ${simId}`);

  if (fullRefresh || !metroReady()) {
    if (fullRefresh) {
      console.log("→ 硬刷新：重启 Metro 并清缓存 …");
    } else {
      console.log("→ Metro 未在 8081 就绪，正在启动 …");
    }
    killMetro();
    if (fullRefresh) {
      clearMetroCaches();
    }
    startMetro();
    if (!waitForMetro()) {
      console.error(`✗ Metro 超时。查看日志: tail -f ${METRO_LOG}`);
      process.exit(1);
    }
    console.log("  ✓ Metro 就绪");
  } else {
    console.log("→ Metro 已在运行 (8081)");
  }

  restartApp(simId);
  console.log("");
  console.log("✓ 完成。若仍看到旧文案：");
  console.log("  1) 确认 Xcode Scheme 为 Debug（Release 会用内置 jsbundle，⌘R 无效）");
  console.log("  2) 再跑一次: npm run mobile:dev:reload -- --full");
  console.log("  3) 开发中优先保存文件触发 Fast Refresh，比 ⌘R 更稳");
}

main();
