#!/usr/bin/env node
/**
 * 把五篇长信经正文生成为静态 JSON：public/data/historical-creeds/{id}.json
 * 网页打开全文时再取（见 lib/explore/historical-creeds-body-load-web.ts）。产物不入库，由 prebuild 生成。
 * 增量缓存：信经源文件与脚本指纹未变且产物存在时直接跳过；支持 FORCE_PREBUILD=1。
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const outDir = path.join(repoRoot, "public", "data", "historical-creeds");
const srcDir = path.join(repoRoot, "lib", "explore", "historical-creeds-bodies");
const cachePath = path.join(repoRoot, "node_modules", ".cache", "askbible-prebuild", "build-static-creed-bodies.json");
const force = process.argv.includes("--force") || process.env.FORCE_PREBUILD === "1";

type CacheFile = {
  version: 1;
  fingerprint: string;
  files: string[];
};

function sha256File(absPath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
}

function computeFingerprint(): string {
  const hash = crypto.createHash("sha256");
  hash.update(`script:${sha256File(scriptPath)}\n`);
  if (fs.existsSync(srcDir)) {
    const entries = fs
      .readdirSync(srcDir)
      .filter((n) => n.endsWith(".ts"))
      .sort();
    for (const name of entries) {
      const abs = path.join(srcDir, name);
      const st = fs.statSync(abs);
      hash.update(`${name}:${st.size}:${sha256File(abs)}\n`);
    }
  }
  return hash.digest("hex");
}

function readCache(): CacheFile | null {
  if (!fs.existsSync(cachePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, "utf8")) as Partial<CacheFile>;
    if (parsed?.version === 1 && typeof parsed.fingerprint === "string" && Array.isArray(parsed.files)) {
      return { version: 1, fingerprint: parsed.fingerprint, files: parsed.files };
    }
  } catch {
    /* ignore corrupt cache */
  }
  return null;
}

function outputIntact(expectedFiles: string[]): boolean {
  if (expectedFiles.length === 0 || !fs.existsSync(outDir)) return false;
  let actual: string[];
  try {
    actual = fs.readdirSync(outDir).filter((n) => n.endsWith(".json"));
  } catch {
    return false;
  }
  if (actual.length !== expectedFiles.length) return false;
  const actualSet = new Set(actual);
  for (const name of expectedFiles) {
    if (!actualSet.has(name)) return false;
  }
  return true;
}

async function main(): Promise<void> {
  const fingerprint = computeFingerprint();
  const prev = readCache();
  if (!force && prev && prev.fingerprint === fingerprint && outputIntact(prev.files)) {
    console.log(`静态信经正文：未变动，跳过（${prev.files.length} 个文件 → public/data/historical-creeds/）`);
    return;
  }

  const { LAZY_HISTORICAL_CREED_BODIES } = await import("../lib/explore/historical-creeds-bodies/lazy-bodies");

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  let total = 0;
  const writtenFiles: string[] = [];
  for (const [id, body] of Object.entries(LAZY_HISTORICAL_CREED_BODIES)) {
    if (!Array.isArray(body.bodyZh) || !Array.isArray(body.bodyZhTw) || !Array.isArray(body.bodyEn)) {
      throw new Error(`信经正文结构不对：${id}`);
    }
    const json = JSON.stringify({ bodyZh: body.bodyZh, bodyZhTw: body.bodyZhTw, bodyEn: body.bodyEn });
    const fileName = `${id}.json`;
    fs.writeFileSync(path.join(outDir, fileName), json, "utf8");
    writtenFiles.push(fileName);
    total += Buffer.byteLength(json);
  }

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(
    cachePath,
    `${JSON.stringify({ version: 1, fingerprint, files: writtenFiles } satisfies CacheFile)}\n`,
    "utf8",
  );

  console.log(`静态信经正文：${writtenFiles.length} 个文件，${(total / 1048576).toFixed(2)} MB → public/data/historical-creeds/`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
