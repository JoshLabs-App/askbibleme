#!/usr/bin/env node
/**
 * D-47 三端 NativeBridge 双向契约与热更协议静态门禁（tools/check-contracts.mjs）
 *
 * 校验范围：
 * 1. kernel/src/bridge/（Web/纯静态内核桥接层）
 * 2. apps/askbible-ios/（iOS 10% 原生轻壳）
 * 3. apps/askbible-android/（Android 10% 原生轻壳）
 *
 * 锁死契约（docs/UNIFIED-KERNEL-PARALLEL-PLAN.md）：
 * - bible 本地路由：/local-db/chapter, /local-db/search, /local-db/translations
 * - audio：audio.intent, audio.state
 * - shell：shell.setTab, shell.setTheme, shell.haptic, shell.tabSelected, shell.backPressed
 * - pack：pack.status, pack.checkNow, pack.downloadTranslation, pack.readyToSwap, pack.commitSwap
 * - sys：auth.signIn, auth.getSession, auth.signOut, sys.setReminder, sys.syncWidget, sys.shareImage
 * - 热更核心字段（iOS & Android 原生壳）：pack-manifest.json, installedOnBuiltinId, active.json, Cache-Control + no-store
 *
 * 用法：
 *   node tools/check-contracts.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BRIDGE_GROUPS = [
  {
    domain: "bible",
    label: "1. 本地经文库路由 (bible)",
    items: [
      { id: "/local-db/chapter", kind: "route" },
      { id: "/local-db/search", kind: "route" },
      { id: "/local-db/translations", kind: "route" },
    ],
  },
  {
    domain: "audio",
    label: "2. 三路音频 (audio)",
    items: [
      { id: "audio.intent", kind: "symbol" },
      { id: "audio.state", kind: "symbol" },
    ],
  },
  {
    domain: "shell",
    label: "3. 导航壳联动 (shell)",
    items: [
      { id: "shell.setTab", kind: "symbol" },
      { id: "shell.setTheme", kind: "symbol" },
      { id: "shell.haptic", kind: "symbol" },
      { id: "shell.tabSelected", kind: "symbol" },
      { id: "shell.backPressed", kind: "symbol" },
    ],
  },
  {
    domain: "pack",
    label: "4. 离线包与热更 (pack)",
    items: [
      { id: "pack.status", kind: "symbol" },
      { id: "pack.checkNow", kind: "symbol" },
      { id: "pack.downloadTranslation", kind: "symbol" },
      { id: "pack.readyToSwap", kind: "symbol" },
      { id: "pack.commitSwap", kind: "symbol" },
    ],
  },
  {
    domain: "sys",
    label: "5. 账号与系统 (sys)",
    items: [
      { id: "auth.signIn", kind: "symbol" },
      { id: "auth.getSession", kind: "symbol" },
      { id: "auth.signOut", kind: "symbol" },
      { id: "sys.setReminder", kind: "symbol" },
      { id: "sys.syncWidget", kind: "symbol" },
      { id: "sys.shareImage", kind: "symbol" },
    ],
  },
];

const PACK_MANIFEST_KEYS = ["schemaVersion", "bundleId", "builtAt", "entry", "files"];

const TARGETS = [
  {
    id: "kernel",
    label: "内核桥接 (kernel/src/bridge/)",
    relDir: "kernel/src/bridge",
    extensions: new Set([".ts", ".tsx", ".js", ".mjs"]),
    requireHotPackProtocol: false,
  },
  {
    id: "ios",
    label: "iOS 轻壳 (apps/askbible-ios/)",
    relDir: "apps/askbible-ios",
    extensions: new Set([".swift"]),
    requireHotPackProtocol: true,
  },
  {
    id: "android",
    label: "Android 轻壳 (apps/askbible-android/)",
    relDir: "apps/askbible-android",
    extensions: new Set([".kt", ".java"]),
    requireHotPackProtocol: true,
  },
];

const IGNORED_DIRS = new Set([
  ".git",
  ".gradle",
  ".kotlin",
  ".build",
  "build",
  "DerivedData",
  "Pods",
  "node_modules",
  "Tests",
  "test",
  "androidTest",
  "__tests__",
  "xcuserdata",
]);

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 保留字符串字面量、剥离 // 与 /* *\/ 注释（支持嵌套 /* *\/，兼容 Swift/Kotlin），
 * 防止注释或 TODO 文本造成假阳性。
 */
function stripCommentsPreservingStrings(source) {
  let out = "";
  let i = 0;
  const len = source.length;

  while (i < len) {
    const ch = source[i];
    const next = source[i + 1];

    // Triple-quoted string (Swift / Kotlin)
    if (ch === '"' && source[i + 1] === '"' && source[i + 2] === '"') {
      out += '"""';
      i += 3;
      while (i < len) {
        if (source[i] === "\\" && i + 1 < len) {
          out += source.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (source[i] === '"' && source[i + 1] === '"' && source[i + 2] === '"') {
          out += '"""';
          i += 3;
          break;
        }
        out += source[i++];
      }
      continue;
    }

    // Single, double, or template string literal
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += quote;
      i += 1;
      while (i < len) {
        const cur = source[i];
        if (cur === "\\" && i + 1 < len) {
          out += cur + source[i + 1];
          i += 2;
          continue;
        }
        out += cur;
        i += 1;
        if (cur === quote) break;
      }
      continue;
    }

    // Line comment
    if (ch === "/" && next === "/") {
      i += 2;
      while (i < len && source[i] !== "\n") {
        i += 1;
      }
      continue;
    }

    // Block comment (supports nesting for Swift/Kotlin)
    if (ch === "/" && next === "*") {
      let depth = 1;
      i += 2;
      while (i < len && depth > 0) {
        if (source[i] === "/" && source[i + 1] === "*") {
          depth += 1;
          i += 2;
        } else if (source[i] === "*" && source[i + 1] === "/") {
          depth -= 1;
          i += 2;
        } else {
          if (source[i] === "\n") out += "\n";
          i += 1;
        }
      }
      out += " ";
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

function collectSourceFiles(dirPath, extensions, out = []) {
  if (!existsSync(dirPath)) return out;
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, extensions, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!extensions.has(ext)) continue;
      if (/\.(?:test|spec)\.[^.]+$/i.test(entry.name) || entry.name.endsWith(".d.ts")) continue;
      const rel = path.relative(ROOT, full).split(path.sep).join("/");
      const raw = readFileSync(full, "utf8");
      out.push({
        relPath: rel,
        code: stripCommentsPreservingStrings(raw),
      });
    }
  }
  return out;
}

function hasBridgeItem(files, item) {
  if (item.kind === "route") {
    // 兼容 "/local-db/chapter" 或去掉前导斜杠的 "local-db/chapter"
    const bare = item.id.replace(/^\//, "");
    const re = new RegExp(`(?:^|[^a-zA-Z0-9_.-])\\/?${escapeRegExp(bare)}(?=$|[^a-zA-Z0-9_.-])`);
    return files.some((f) => re.test(f.code));
  }
  const re = new RegExp(`(?:^|[^a-zA-Z0-9_.])${escapeRegExp(item.id)}(?=$|[^a-zA-Z0-9_])`);
  return files.some((f) => re.test(f.code));
}

function checkHotPackProtocol(files) {
  const missing = [];

  const hasManifestRef = files.some((f) => /\bpack-manifest\.json\b/.test(f.code));
  if (!hasManifestRef) missing.push("pack-manifest.json");

  const hasBuiltinId = files.some((f) => /\binstalledOnBuiltinId\b/.test(f.code));
  if (!hasBuiltinId) missing.push("installedOnBuiltinId");

  const hasActiveJson = files.some((f) => /\bactive\.json\b/.test(f.code));
  if (!hasActiveJson) missing.push("active.json");

  const hasCacheControlNoStore = files.some(
    (f) => /cache-control/i.test(f.code) && /no-store/i.test(f.code),
  );
  if (!hasCacheControlNoStore) missing.push("Cache-Control: no-store");

  return missing;
}

function checkDistManifestIfPresent() {
  const manifestPath = path.join(ROOT, "kernel", "dist-pack", "pack-manifest.json");
  if (!existsSync(manifestPath)) {
    return { status: "skipped", missingKeys: [] };
  }
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
    const missingKeys = PACK_MANIFEST_KEYS.filter((k) => !(k in parsed));
    return {
      status: missingKeys.length === 0 ? "ok" : "invalid",
      missingKeys,
    };
  } catch {
    return { status: "parse_error", missingKeys: PACK_MANIFEST_KEYS };
  }
}

function main() {
  const t0 = performance.now();
  const totalBridgeItems = BRIDGE_GROUPS.reduce((sum, g) => sum + g.items.length, 0);
  const failures = [];
  const targetStats = [];

  for (const target of TARGETS) {
    const absDir = path.join(ROOT, target.relDir);
    if (!existsSync(absDir) || !statSync(absDir).isDirectory()) {
      failures.push(`[${target.label}] 目录不存在，缺少全部 ${totalBridgeItems} 项 NativeBridge 契约`);
      continue;
    }

    const files = collectSourceFiles(absDir, target.extensions);
    if (files.length === 0) {
      failures.push(`[${target.label}] 未扫描到源码文件，缺少全部 ${totalBridgeItems} 项 NativeBridge 契约`);
      continue;
    }

    const missingByGroup = [];
    let matchedCount = 0;

    for (const group of BRIDGE_GROUPS) {
      const missingItems = [];
      for (const item of group.items) {
        if (hasBridgeItem(files, item)) {
          matchedCount += 1;
        } else {
          missingItems.push(item.id);
        }
      }
      if (missingItems.length > 0) {
        missingByGroup.push(`  - [${target.id}] ${group.label} 缺失: ${missingItems.join(", ")}`);
      }
    }

    let hotMissing = [];
    if (target.requireHotPackProtocol) {
      hotMissing = checkHotPackProtocol(files);
      if (hotMissing.length > 0) {
        missingByGroup.push(`  - [${target.id}] 热更与缓存协议缺失: ${hotMissing.join(", ")}`);
      }
    }

    if (missingByGroup.length > 0) {
      failures.push(`[${target.label}] 契约不完整 (${matchedCount}/${totalBridgeItems}):\n` + missingByGroup.join("\n"));
    } else {
      targetStats.push(`${target.id}=${matchedCount}/${totalBridgeItems} (${files.length} files)`);
    }
  }

  // 同时校验 tools/build-app-pack.mjs 与已构建的 pack-manifest.json（若存在）是否包含全部契约字段
  const builderPath = path.join(ROOT, "tools", "build-app-pack.mjs");
  if (existsSync(builderPath)) {
    const builderSrc = readFileSync(builderPath, "utf8");
    const missingBuilderFields = PACK_MANIFEST_KEYS.filter((k) => !new RegExp(`\\b${k}\\b`).test(builderSrc));
    if (missingBuilderFields.length > 0) {
      failures.push(`[tools/build-app-pack.mjs] 缺少 pack-manifest.json 契约字段: ${missingBuilderFields.join(", ")}`);
    }
  } else {
    failures.push("[tools/build-app-pack.mjs] 文件不存在");
  }

  const distManifest = checkDistManifestIfPresent();
  if (distManifest.status === "invalid") {
    failures.push(`[kernel/dist-pack/pack-manifest.json] 缺少字段: ${distManifest.missingKeys.join(", ")}`);
  } else if (distManifest.status === "parse_error") {
    failures.push("[kernel/dist-pack/pack-manifest.json] JSON 解析失败");
  }

  const ms = (performance.now() - t0).toFixed(1);

  if (failures.length > 0) {
    console.error("❌ D-47 三端 NativeBridge 与热更契约门禁未通过：\n\n" + failures.join("\n\n"));
    console.error(`\n（耗时 ${ms}ms）`);
    process.exit(1);
  }

  const manifestNote =
    distManifest.status === "ok" ? "pack-manifest.json=已就绪" : "pack-manifest.json=生成契约就绪（待构建 dist-pack）";
  console.log(
    `✅ D-47 三端 NativeBridge 与热更契约门禁全绿（5 组 ${totalBridgeItems} 项 · ${targetStats.join(" · ")} · ${manifestNote} · 耗时 ${ms}ms）`,
  );
}

main();
