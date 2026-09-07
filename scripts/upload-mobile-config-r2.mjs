#!/usr/bin/env node
/**
 * 把 scripts/build-mobile-config-r2.ts 生成的 8 个配置 JSON 上传到 Cloudflare R2。
 *
 *   npx tsx scripts/build-mobile-config-r2.ts --verify   # 先生成并与线上比对
 *   node scripts/upload-mobile-config-r2.mjs --dry-run   # 看将要写哪些键
 *   node scripts/upload-mobile-config-r2.mjs             # 真正上传
 *
 * 认证走 wrangler OAuth（与 upload-music-companion-r2-fast.mjs 一致），本机 `wrangler login` 过即可，
 * 不需要在环境里放 R2 密钥。
 *
 * R2 键不带扩展名，与线上路由路径一一对应：
 *   .artifacts/mobile-config-r2/api/music/companion.json → {bucket}/api/music/companion
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(repoRoot, ".artifacts", "mobile-config-r2");
const bucket = process.env.R2_BUCKET || "askbible-media";
const publicBase =
  process.env.R2_PUBLIC_BASE_URL || "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev";
const dryRun = process.argv.includes("--dry-run");

/** 收集 srcDir 下所有 .json，键 = 相对路径去掉 .json。 */
function collect(dir, prefix = "") {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const abs = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (fs.statSync(abs).isDirectory()) out.push(...collect(abs, rel));
    else if (name.endsWith(".json")) out.push({ abs, key: rel.replace(/\.json$/, "") });
  }
  return out;
}

function putWithWrangler(absPath, key) {
  const res = spawnSync(
    "npx",
    [
      "--no-install",
      "wrangler",
      "r2",
      "object",
      "put",
      `${bucket}/${key}`,
      "--file",
      absPath,
      "--content-type",
      "application/json; charset=utf-8",
      /** 配置很小且要求即时生效；缓存交给网站那层 307 与 App 自己的 ttl 控制。 */
      "--cache-control",
      "public, max-age=60",
      "--remote",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (res.status !== 0) {
    throw new Error(`上传失败 ${key}：${(res.stderr || res.stdout || "").slice(0, 400)}`);
  }
}

async function main() {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`没有产物目录 ${path.relative(repoRoot, srcDir)}，先跑 build-mobile-config-r2.ts`);
  }
  const files = collect(srcDir);
  if (files.length === 0) throw new Error("产物目录是空的");

  console.log(`${dryRun ? "[dry-run] " : ""}上传 ${files.length} 个对象到 ${bucket}`);
  for (const { abs, key } of files) {
    const bytes = fs.statSync(abs).size;
    console.log(`  ${String(bytes).padStart(8)} B  ${key}`);
    if (!dryRun) putWithWrangler(abs, key);
  }
  if (dryRun) return;

  console.log("\n回读校验（公开地址）：");
  let bad = 0;
  for (const { abs, key } of files) {
    const local = fs.readFileSync(abs, "utf8");
    let verdict;
    try {
      const res = await fetch(`${publicBase}/${key}`, { cache: "no-store" });
      const remote = await res.text();
      verdict = !res.ok
        ? `HTTP ${res.status}`
        : remote === local
          ? "一致"
          : `内容不符（远端 ${Buffer.byteLength(remote)}B / 本地 ${Buffer.byteLength(local)}B）`;
    } catch (e) {
      verdict = `取回失败：${e instanceof Error ? e.message.slice(0, 60) : String(e)}`;
    }
    if (verdict !== "一致") bad += 1;
    console.log(`  ${verdict === "一致" ? "✓" : "✗"} ${verdict.padEnd(24)} ${key}`);
  }
  if (bad > 0) {
    console.error(`\n${bad} 个回读不一致，先别改网站重定向。`);
    process.exitCode = 1;
  } else {
    console.log(`\n全部就绪：${publicBase}/api/...`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
