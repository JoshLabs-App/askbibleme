#!/usr/bin/env node
/**
 * 把 App 用到的 8 个「纯配置」接口抓成静态 JSON，供上传 Cloudflare R2。
 *
 *   npm run dev                                            # 另开一个终端
 *   npx tsx scripts/build-mobile-config-r2.ts               # 从本机 dev 抓
 *   npx tsx scripts/build-mobile-config-r2.ts --verify      # 再与线上逐字节比对
 *   MOBILE_CONFIG_BASE=https://askbible.me npx tsx scripts/build-mobile-config-r2.ts
 *
 * 为什么抓 HTTP 而不是 import 路由：路由链上有 `server-only`（Next 内部虚拟模块），
 * tsx 解析不了；而这些本来就是 HTTP 接口，抓真身既省事又保证与现网逐字节一致——
 * 已上架的 App 认的是这个结构，任何复刻逻辑都可能漂移。
 *
 * 上传见 scripts/upload-mobile-config-r2.mjs，与本脚本分开，便于先验证再推送。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, ".artifacts", "mobile-config-r2");
const BASE = (process.env.MOBILE_CONFIG_BASE || "http://localhost:3450").replace(/\/$/, "");
const LIVE_BASE = (process.env.MOBILE_CONFIG_LIVE_BASE || "https://askbible.me").replace(/\/$/, "");

/** R2 对象键 = 路径去掉开头 "/"，App 只需换 base。 */
export const MOBILE_CONFIG_ROUTES = [
  "/api/mobile/content/manifest",
  "/api/mobile/bible/translations",
  "/api/mobile/explore/modules",
  "/api/mobile/explore/legacy-figures",
  "/api/mobile/explore/featured-articles",
  "/api/music/companion",
  "/api/nature/settings",
  "/api/read/reading-plans/registry",
] as const;

/**
 * R2 键与路由路径一一对应且**不加扩展名**：
 *   /api/music/companion → {r2}/api/music/companion
 * 这样网站只需把该路径 307 到 `{r2}{同样的路径}`，App 将来也只需换 base 而不改路径。
 * Content-Type 在上传时显式指定为 application/json。
 */
export function r2KeyForRoute(route: string): string {
  return route.replace(/^\//, "");
}

/** 本地落盘带 .json 后缀，纯为方便查看与 diff；R2 上的键不带。 */
function outPathForRoute(route: string): string {
  return path.join(outDir, `${r2KeyForRoute(route)}.json`);
}

async function fetchJsonText(base: string, route: string): Promise<string> {
  const res = await fetch(`${base}${route}`, { headers: { Accept: "application/json" } });
  const body = await res.text();
  if (!res.ok) throw new Error(`${base}${route} → ${res.status}：${body.slice(0, 160)}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    throw new Error(`${base}${route} 返回的不是 JSON（${type}），dev server 起了吗？`);
  }
  JSON.parse(body); // 结构必须可解析，坏 JSON 绝不能推上 R2
  return body;
}

/**
 * 与线上比对时允许的已知差异——每条都查证过，不是为了让比对通过而放宽：
 *
 * - manifest.generatedAt：每次请求现取的时间戳，本地与线上永远不可能相同。
 * - translations[].bytes：线上 Render 上 `next.config.mjs` 的 outputFileTracingIncludes
 *   没带上 `data/bible/sqlite/*.sqlite`，API function 里 existsSync 为 false，体积一律算 0
 *   （App 译本下载页因此显示「0 B」）。本机能读到真实文件，生成的才是对的——
 *   推上 R2 正好顺手修掉这个 bug，所以这里以本地为准。
 */
function stripKnownDiffs(route: string, value: unknown): unknown {
  if (route === "/api/mobile/content/manifest" && value && typeof value === "object") {
    const { generatedAt: _drop, ...rest } = value as Record<string, unknown>;
    return rest;
  }
  if (route === "/api/mobile/bible/translations" && value && typeof value === "object") {
    const v = value as { translations?: Record<string, unknown>[] };
    if (Array.isArray(v.translations)) {
      return {
        ...v,
        translations: v.translations.map(({ bytes: _b, ...t }) => t),
      };
    }
  }
  return value;
}

/** 结构等价即可：App 走 JSON.parse，不比较原始字节。 */
function sameJson(route: string, a: string, b: string): boolean {
  if (a === b) return true;
  try {
    const norm = (s: string) => JSON.stringify(stripKnownDiffs(route, JSON.parse(s)));
    return norm(a) === norm(b);
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const verify = process.argv.includes("--verify");
  fs.rmSync(outDir, { recursive: true, force: true });

  console.log(`从 ${BASE} 抓取 → ${path.relative(repoRoot, outDir)}/`);
  let total = 0;
  for (const route of MOBILE_CONFIG_ROUTES) {
    const body = await fetchJsonText(BASE, route);
    const dest = outPathForRoute(route);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, body, "utf8");
    const bytes = Buffer.byteLength(body);
    total += bytes;
    console.log(`  ${String(bytes).padStart(8)} B  ${route}`);
  }
  console.log(`  ${String(total).padStart(8)} B  合计 ${MOBILE_CONFIG_ROUTES.length} 个`);

  if (!verify) return;

  console.log(`\n与 ${LIVE_BASE} 比对：`);
  let mismatched = 0;
  for (const route of MOBILE_CONFIG_ROUTES) {
    const local = fs.readFileSync(outPathForRoute(route), "utf8");
    let verdict: string;
    try {
      verdict = sameJson(route, local, await fetchJsonText(LIVE_BASE, route))
        ? "一致"
        : `不一致（本地 ${Buffer.byteLength(local)}B）`;
    } catch (e) {
      verdict = `线上取不到：${e instanceof Error ? e.message.slice(0, 60) : String(e)}`;
    }
    if (verdict !== "一致") mismatched += 1;
    console.log(`  ${verdict === "一致" ? "✓" : "✗"} ${verdict.padEnd(30)} ${route}`);
  }
  if (mismatched > 0) {
    console.error(`\n${mismatched} 个与线上不一致，先查清原因再上传。`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
