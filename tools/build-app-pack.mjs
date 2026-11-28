#!/usr/bin/env node
/**
 * D-47 同源纯静态内核热更包清单生成器与校验门禁（pack-manifest.json）
 *
 * 契约真源：docs/UNIFIED-KERNEL-PARALLEL-PLAN.md
 * 产出格式：
 * {
 *   "schemaVersion": 1,
 *   "bundleId": "20261127-abc1234",
 *   "builtAt": "2026-11-27T21:30:00Z",
 *   "entry": "index.html",
 *   "files": {
 *     "index.html": { "size": 1842, "sha256": "..." },
 *     "assets/app-9a8b7c.js": { "size": 94120, "sha256": "..." }
 *   }
 * }
 *
 * 用法：
 *   node tools/build-app-pack.mjs                  # 扫描 kernel/dist-pack/ 并写入 pack-manifest.json
 *   node tools/build-app-pack.mjs --dir <path>     # 指定构建产物目录
 *   node tools/build-app-pack.mjs --check          # 校验 pack-manifest.json 一致性及首屏主 JS gzip <= 160KB
 *   node tools/build-app-pack.mjs --sync-native    # 生成并校验 pack-manifest.json 后完整镜像复制到 iOS/Android app-pack/
 */

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DIST_DIR = path.join(ROOT, "kernel", "dist-pack");
const NATIVE_SYNC_TARGETS = [
  path.join(ROOT, "apps", "askbible-ios", "AskBible", "Resources", "app-pack.bundle"),
  path.join(ROOT, "apps", "askbible-android", "app", "src", "main", "assets", "app-pack"),
];
const MANIFEST_FILENAME = "pack-manifest.json";
const ENTRY_FILE = "index.html";
const MAX_MAIN_JS_GZIP_BYTES = 160 * 1024;
const IGNORED_FILENAMES = new Set([".DS_Store", "Thumbs.db", MANIFEST_FILENAME]);

function printUsage() {
  console.log(`用法:
  node tools/build-app-pack.mjs [--dir <path>] [--bundle-id <id>] [--check] [--sync-native]

选项:
  --dir <path>        指定静态构建产物目录（默认: kernel/dist-pack）
  --bundle-id <id>    指定 bundleId（默认: YYYYMMDD-<7位内容哈希>）
  --check             只读校验 pack-manifest.json 与文件 size + sha256 一致性，并校验首屏主 JS gzip <= 160KB
  --sync-native       生成并校验 pack-manifest.json 后，将静态包完整镜像同步至 iOS/Android 内置 app-pack/
  -h, --help          显示帮助信息`);
}

function parseArgs(argv) {
  let dir = DEFAULT_DIST_DIR;
  let check = false;
  let syncNative = false;
  let bundleId = null;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") {
      check = true;
    } else if (arg === "--sync-native") {
      syncNative = true;
    } else if (arg === "-h" || arg === "--help") {
      help = true;
    } else if (arg === "--dir") {
      const next = argv[++i];
      if (!next) {
        throw new Error("--dir 需要提供目录路径");
      }
      dir = path.resolve(process.cwd(), next);
    } else if (arg.startsWith("--dir=")) {
      const val = arg.slice("--dir=".length);
      if (!val) {
        throw new Error("--dir= 需要提供目录路径");
      }
      dir = path.resolve(process.cwd(), val);
    } else if (arg === "--bundle-id") {
      const next = argv[++i];
      if (!next) {
        throw new Error("--bundle-id 需要提供标识字符串");
      }
      bundleId = next.trim();
    } else if (arg.startsWith("--bundle-id=")) {
      const val = arg.slice("--bundle-id=".length).trim();
      if (!val) {
        throw new Error("--bundle-id= 需要提供标识字符串");
      }
      bundleId = val;
    } else {
      throw new Error(`未知参数: ${arg}`);
    }
  }

  return { dir, check, syncNative, bundleId, help };
}

function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function walkStaticFiles(baseDir, currentDir = baseDir, records = new Map()) {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_FILENAMES.has(entry.name) || entry.name.endsWith(".part")) {
      continue;
    }
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git") continue;
      walkStaticFiles(baseDir, fullPath, records);
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).split(path.sep).join("/");
      const buf = readFileSync(fullPath);
      records.set(relPath, {
        size: buf.length,
        sha256: sha256Hex(buf),
        buffer: buf,
      });
    }
  }
  return records;
}

function getAttr(tag, attrName) {
  const re = new RegExp(`\\b${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = tag.match(re);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function normalizeLocalAssetPath(rawUrl) {
  const clean = rawUrl.split("#")[0].split("?")[0].trim();
  if (!clean || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(clean)) {
    return null;
  }
  return clean.replace(/^\.?\//, "");
}

function analyzeMainJsGzip(filesMap) {
  const entryRecord = filesMap.get(ENTRY_FILE);
  if (!entryRecord) {
    return { missingRefs: [], entryScripts: [], totalGzipBytes: 0, mode: "no-entry" };
  }

  const html = entryRecord.buffer.toString("utf8");
  const entryScripts = [];
  const missingRefs = [];
  const seen = new Set();

  for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = match[1] ?? "";
    const type = (getAttr(attrs, "type") ?? "").toLowerCase();
    if (type === "application/json" || type === "application/ld+json" || type === "importmap") {
      continue;
    }
    const src = getAttr(attrs, "src");
    if (!src) continue;
    const rel = normalizeLocalAssetPath(src);
    if (!rel) continue;
    if (!/\.(?:m?js)$/i.test(rel)) continue;
    if (seen.has(rel)) continue;
    seen.add(rel);

    const fileRec = filesMap.get(rel);
    if (!fileRec) {
      missingRefs.push(rel);
      continue;
    }
    const gzipBytes = gzipSync(fileRec.buffer, { level: 9 }).length;
    entryScripts.push({ relPath: rel, rawBytes: fileRec.size, gzipBytes });
  }

  if (entryScripts.length > 0 || missingRefs.length > 0) {
    const totalGzipBytes = entryScripts.reduce((sum, item) => sum + item.gzipBytes, 0);
    return { missingRefs, entryScripts, totalGzipBytes, mode: "html-script-src" };
  }

  const fallbackCandidates = [...filesMap.entries()]
    .filter(([rel]) => /\.(?:m?js)$/i.test(rel) && !/(?:^|\/)sw\.m?js$/i.test(rel))
    .sort((a, b) => b[1].size - a[1].size);

  if (fallbackCandidates.length > 0) {
    const [rel, rec] = fallbackCandidates[0];
    const gzipBytes = gzipSync(rec.buffer, { level: 9 }).length;
    return {
      missingRefs: [],
      entryScripts: [{ relPath: rel, rawBytes: rec.size, gzipBytes }],
      totalGzipBytes: gzipBytes,
      mode: "fallback-largest-js",
    };
  }

  return { missingRefs: [], entryScripts: [], totalGzipBytes: 0, mode: "inline-only" };
}

function buildManifest(filesMap, customBundleId) {
  const sortedEntries = [...filesMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  const files = {};
  const hasher = createHash("sha256");

  for (const [relPath, rec] of sortedEntries) {
    files[relPath] = {
      size: rec.size,
      sha256: rec.sha256,
    };
    hasher.update(`${relPath}\0${rec.size}\0${rec.sha256}\n`);
  }

  const contentHash = hasher.digest("hex");
  const now = new Date();
  const utcDate = now.toISOString().slice(0, 10).replaceAll("-", "");
  const builtAt = now.toISOString().replace(/\.\d{3}Z$/, "Z");

  return {
    schemaVersion: 1,
    bundleId: customBundleId || `${utcDate}-${contentHash.slice(0, 7)}`,
    builtAt,
    entry: ENTRY_FILE,
    files,
  };
}

function verifyTargetDirExists(targetDir) {
  const displayDir = path.relative(ROOT, targetDir) || targetDir;
  if (!existsSync(targetDir)) {
    console.error(
      `⚠️ 目标构建目录尚未生成: ${displayDir}\n` +
        `   请先构建纯静态内核（如: cd kernel && npm run build），或使用 --dir <path> 指定目录。`,
    );
    process.exit(1);
  }
  const st = statSync(targetDir);
  if (!st.isDirectory()) {
    console.error(`❌ 指定路径不是目录: ${displayDir}`);
    process.exit(1);
  }
}

function runCheck(targetDir, filesMap) {
  const displayDir = path.relative(ROOT, targetDir) || targetDir;
  const manifestPath = path.join(targetDir, MANIFEST_FILENAME);
  if (!existsSync(manifestPath)) {
    console.error(
      `❌ 缺少 ${path.join(displayDir, MANIFEST_FILENAME)}\n` +
        `   请先运行: node tools/build-app-pack.mjs${targetDir === DEFAULT_DIST_DIR ? "" : ` --dir ${targetDir}`}`,
    );
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    console.error(`❌ 无法解析 ${MANIFEST_FILENAME}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const errors = [];
  if (manifest?.schemaVersion !== 1) {
    errors.push(`schemaVersion 必须为 1，当前为 ${JSON.stringify(manifest?.schemaVersion)}`);
  }
  if (typeof manifest?.bundleId !== "string" || manifest.bundleId.trim().length === 0) {
    errors.push("bundleId 必须为非空字符串");
  }
  if (typeof manifest?.builtAt !== "string" || Number.isNaN(Date.parse(manifest.builtAt))) {
    errors.push(`builtAt 必须为有效 ISO-8601 时间字符串，当前为 ${JSON.stringify(manifest?.builtAt)}`);
  }
  if (manifest?.entry !== ENTRY_FILE) {
    errors.push(`entry 必须为 "${ENTRY_FILE}"，当前为 ${JSON.stringify(manifest?.entry)}`);
  }
  if (!manifest?.files || typeof manifest.files !== "object" || Array.isArray(manifest.files)) {
    errors.push("files 必须为键值对象");
  } else {
    if (!manifest.files[ENTRY_FILE]) {
      errors.push(`files 中缺少入口文件 "${ENTRY_FILE}"`);
    }

    for (const [relPath, actual] of [...filesMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const declared = manifest.files[relPath];
      if (!declared || typeof declared !== "object") {
        errors.push(`目录内文件未登记在 ${MANIFEST_FILENAME}: ${relPath}`);
        continue;
      }
      if (declared.size !== actual.size) {
        errors.push(`文件大小不一致 ${relPath}: manifest=${declared.size}, 实际=${actual.size}`);
      }
      if (typeof declared.sha256 !== "string" || declared.sha256.toLowerCase() !== actual.sha256) {
        errors.push(`文件 SHA-256 不一致 ${relPath}: manifest=${declared.sha256}, 实际=${actual.sha256}`);
      }
    }

    for (const relPath of Object.keys(manifest.files).sort()) {
      if (!filesMap.has(relPath)) {
        errors.push(`${MANIFEST_FILENAME} 引用了不存在的文件: ${relPath}`);
      }
    }
  }

  const jsReport = analyzeMainJsGzip(filesMap);
  for (const missingRef of jsReport.missingRefs) {
    errors.push(`${ENTRY_FILE} 引用的首屏 JS 不存在: ${missingRef}`);
  }
  if (jsReport.totalGzipBytes > MAX_MAIN_JS_GZIP_BYTES) {
    const details = jsReport.entryScripts
      .map((s) => `${s.relPath}=${formatKb(s.gzipBytes)}`)
      .join(", ");
    errors.push(
      `首屏主 JS gzip 体积超标: ${formatKb(jsReport.totalGzipBytes)} (${jsReport.totalGzipBytes} B) > 警戒线 ${formatKb(MAX_MAIN_JS_GZIP_BYTES)} (${MAX_MAIN_JS_GZIP_BYTES} B) [${details}]`,
    );
  }

  if (errors.length > 0) {
    console.error(`❌ pack-manifest 校验失败 (${displayDir}):\n` + errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }

  const totalRawBytes = [...filesMap.values()].reduce((sum, rec) => sum + rec.size, 0);
  const jsSummary =
    jsReport.entryScripts.length > 0
      ? `首屏主 JS gzip ${formatKb(jsReport.totalGzipBytes)} / 160.00 KB (${jsReport.entryScripts.map((s) => s.relPath).join(", ")})`
      : "无外链首屏 JS";
  console.log(
    `✅ pack-manifest 校验通过 (${displayDir} · bundleId=${manifest.bundleId} · ${filesMap.size} 文件 · 总计 ${formatKb(totalRawBytes)} · ${jsSummary})`,
  );
}

function mirrorDirAtomic(sourceDir, targetDir) {
  const parentDir = path.dirname(targetDir);
  mkdirSync(parentDir, { recursive: true });
  const stagingDir = path.join(parentDir, `.${path.basename(targetDir)}.staging-${process.pid}`);
  rmSync(stagingDir, { recursive: true, force: true });
  try {
    cpSync(sourceDir, stagingDir, {
      recursive: true,
      filter: (src) => {
        const name = path.basename(src);
        return name !== ".DS_Store" && name !== "Thumbs.db" && name !== ".git" && !name.endsWith(".part");
      },
    });
    rmSync(targetDir, { recursive: true, force: true });
    renameSync(stagingDir, targetDir);
  } catch (err) {
    rmSync(stagingDir, { recursive: true, force: true });
    throw err;
  }
}

function syncNativeAppPacks(sourceDir) {
  for (const targetDir of NATIVE_SYNC_TARGETS) {
    mirrorDirAtomic(sourceDir, targetDir);
    const targetFiles = walkStaticFiles(targetDir);
    runCheck(targetDir, targetFiles);
    console.log(`📦 已镜像同步至 ${path.relative(ROOT, targetDir)}/`);
  }
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`❌ 参数错误: ${err instanceof Error ? err.message : String(err)}`);
    printUsage();
    process.exit(1);
  }

  if (options.help) {
    printUsage();
    return;
  }

  verifyTargetDirExists(options.dir);

  const filesMap = walkStaticFiles(options.dir);
  const displayDir = path.relative(ROOT, options.dir) || options.dir;

  if (filesMap.size === 0) {
    console.error(`⚠️ 目标构建目录为空: ${displayDir}（请先构建静态内核后再生成/校验清单）`);
    process.exit(1);
  }
  if (!filesMap.has(ENTRY_FILE)) {
    console.error(`❌ 目标构建目录缺少入口文件 ${ENTRY_FILE}: ${displayDir}`);
    process.exit(1);
  }

  if (options.check && !options.syncNative) {
    runCheck(options.dir, filesMap);
    return;
  }

  if (!options.check) {
    const manifest = buildManifest(filesMap, options.bundleId);
    const manifestPath = path.join(options.dir, MANIFEST_FILENAME);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

    const totalRawBytes = [...filesMap.values()].reduce((sum, rec) => sum + rec.size, 0);
    const jsReport = analyzeMainJsGzip(filesMap);
    const jsSummary =
      jsReport.entryScripts.length > 0
        ? `首屏主 JS gzip ${formatKb(jsReport.totalGzipBytes)} / 160.00 KB`
        : "无外链首屏 JS";

    console.log(
      `✅ 已生成 ${path.join(displayDir, MANIFEST_FILENAME)} (bundleId=${manifest.bundleId} · ${filesMap.size} 文件 · 总计 ${formatKb(totalRawBytes)} · ${jsSummary})`,
    );
    if (jsReport.totalGzipBytes > MAX_MAIN_JS_GZIP_BYTES) {
      console.warn(
        `⚠️ 警告: 首屏主 JS gzip (${formatKb(jsReport.totalGzipBytes)}) 已超过 160.00 KB 警戒线，--check 模式将被拦截`,
      );
    }
  }

  if (options.syncNative) {
    const refreshedFiles = walkStaticFiles(options.dir);
    runCheck(options.dir, refreshedFiles);
    syncNativeAppPacks(options.dir);
  }
}

main();
