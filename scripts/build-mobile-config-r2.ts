#!/usr/bin/env node
/**
 * 把 App 用到的 8 个「纯配置」接口生成为静态 JSON，供上传 Cloudflare R2。
 *
 *   npm run mobile:config:build     # 从本地 data/*.json 生成
 *   npm run mobile:config:verify    # 再比对 R2 上那份是否已是最新
 *   npm run mobile:config:push-r2   # 生成 + 上传（改完内容就跑这个）
 *
 * 直接调用各路由自己的 GET()，不经 HTTP：
 * - 生产环境这些路径已 307 到 R2（见 next.config.mjs），从线上抓只会抓回 R2 上的旧内容，
 *   自我循环，永远推不上新的；
 * - 不依赖 dev server 在跑，因此可以串进 scripts/ship-data-config.sh；
 * - 调路由真身而非复刻构造逻辑，保证与现网结构一致——已上架 App 认的就是这个结构。
 *
 * 必须用 scripts/tsconfig.config-build.json 跑：它把 Next 的虚拟模块 `server-only`
 * 指到 scripts/stubs/，否则 tsx 解析不了 mobile-content-flags-store 那条链。
 *
 * 上传见 scripts/upload-mobile-config-r2.mjs。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, ".artifacts", "mobile-config-r2");
const LIVE_BASE = (process.env.MOBILE_CONFIG_LIVE_BASE || "https://askbible.me").replace(/\/$/, "");

/**
 * 载入 .env.local：manifest 的 serverCapabilities 依赖 Supabase 配置与
 * MEMBER_REGISTER_ENABLED，缺了会下发 memberRegisterEnabled:false，
 * 推上去就让 App 的注册入口消失。tsx 不像 next dev 会自动读这个文件。
 */
function loadEnvLocal(): void {
  const file = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
}

type Entry = { route: string; load: () => Promise<{ GET: (req: Request) => Promise<Response> | Response }> };

const entries: Entry[] = [
  { route: "/api/mobile/content/manifest", load: () => import("@/app/api/mobile/content/manifest/route") },
  { route: "/api/mobile/bible/translations", load: () => import("@/app/api/mobile/bible/translations/route") },
  { route: "/api/mobile/explore/modules", load: () => import("@/app/api/mobile/explore/modules/route") },
  { route: "/api/mobile/explore/legacy-figures", load: () => import("@/app/api/mobile/explore/legacy-figures/route") },
  { route: "/api/mobile/explore/featured-articles", load: () => import("@/app/api/mobile/explore/featured-articles/route") },
  { route: "/api/music/companion", load: () => import("@/app/api/music/companion/route") },
  { route: "/api/nature/settings", load: () => import("@/app/api/nature/settings/route") },
  { route: "/api/read/reading-plans/registry", load: () => import("@/app/api/read/reading-plans/registry/route") },
];

/** R2 键与路由路径一一对应且不带扩展名；网站只需把同路径 307 过去。 */
export function r2KeyForRoute(route: string): string {
  return route.replace(/^\//, "");
}

/** 本地落盘带 .json，纯为方便查看与 diff；R2 上的键不带。 */
function outPathForRoute(route: string): string {
  return path.join(outDir, `${r2KeyForRoute(route)}.json`);
}

async function generate(entry: Entry): Promise<number> {
  const mod = await entry.load();
  const res = await mod.GET(new Request(`https://askbible.me${entry.route}`));
  const body = await res.text();
  if (res.status !== 200) {
    throw new Error(
      `${entry.route} 返回 ${res.status}（若为 307，说明脚本以 NODE_ENV=production 跑了，` +
        `路由会转去 R2；用默认环境跑）：${body.slice(0, 160)}`,
    );
  }
  JSON.parse(body); // 坏 JSON 绝不能推上 R2
  const dest = outPathForRoute(entry.route);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, body, "utf8");
  return Buffer.byteLength(body);
}

/**
 * 比对时允许的已知差异——查证过，不是为了让比对通过而放宽：
 * - manifest.generatedAt 是现取的时间戳，两边永远不同。
 * - translations[].bytes 线上一律为 0：outputFileTracingIncludes 没带上
 *   data/bible/sqlite/*.sqlite，API function 里 existsSync 为 false。本机读得到真实
 *   文件，以本地为准；镜像到 R2 正好修掉 App 译本下载页显示「0 B」的问题。
 */
function stripKnownDiffs(route: string, value: unknown): unknown {
  if (route === "/api/mobile/content/manifest" && value && typeof value === "object") {
    const { generatedAt: _drop, ...rest } = value as Record<string, unknown>;
    return rest;
  }
  if (route === "/api/mobile/bible/translations" && value && typeof value === "object") {
    const v = value as { translations?: Record<string, unknown>[] };
    if (Array.isArray(v.translations)) {
      return { ...v, translations: v.translations.map(({ bytes: _b, ...t }) => t) };
    }
  }
  return value;
}

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
  loadEnvLocal();
  const verify = process.argv.includes("--verify");
  fs.rmSync(outDir, { recursive: true, force: true });

  console.log(`生成 → ${path.relative(repoRoot, outDir)}/`);
  let total = 0;
  for (const entry of entries) {
    const bytes = await generate(entry);
    total += bytes;
    console.log(`  ${String(bytes).padStart(8)} B  ${entry.route}`);
  }
  console.log(`  ${String(total).padStart(8)} B  合计 ${entries.length} 个`);

  if (!verify) return;

  /** 生产已 307 到 R2，所以这里比的其实是「R2 上那份是否已是最新」。 */
  console.log(`\n比对 ${LIVE_BASE}（生产已转 R2，即检查 R2 是否最新）：`);
  let stale = 0;
  for (const { route } of entries) {
    const local = fs.readFileSync(outPathForRoute(route), "utf8");
    let verdict: string;
    try {
      const res = await fetch(`${LIVE_BASE}${route}`, { headers: { Accept: "application/json" } });
      verdict = !res.ok
        ? `HTTP ${res.status}`
        : sameJson(route, local, await res.text())
          ? "已是最新"
          : "需要推送";
    } catch (e) {
      verdict = `取不到：${e instanceof Error ? e.message.slice(0, 50) : String(e)}`;
    }
    if (verdict !== "已是最新") stale += 1;
    console.log(`  ${verdict === "已是最新" ? "✓" : "→"} ${verdict.padEnd(12)} ${route}`);
  }
  console.log(
    stale === 0 ? "\nR2 已是最新，无需推送。" : `\n${stale} 个待推送：npm run mobile:config:push-r2`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
