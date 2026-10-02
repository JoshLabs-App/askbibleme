#!/usr/bin/env node
/**
 * 防封换线的候选域表（docs/anti-block-endpoints.md、DECISIONS D-20）。
 *
 * 真源：data/endpoints.json（网页端 lib/endpoints 直接 import 它）
 * 产物：public/endpoints.json（网页同源拉这份更新候选表）
 * 对拍：iOS Endpoints.swift / 安卓 Endpoints.kt 里手写的内置表必须和真源逐条一致
 * 上线：桶根的 endpoints.json + healthz.txt（原生两端从桶根拉候选表）
 *
 *   node tools/endpoints-sync.mjs          生成 public/endpoints.json 并对拍
 *   node tools/endpoints-sync.mjs --check  只比对（不一致就退出 1）
 *   node tools/endpoints-sync.mjs --push   对拍通过后传到 R2（wrangler OAuth 登录态）
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const PUSH = process.argv.includes("--push");
const BUCKET = process.env.R2_BUCKET || "askbible-media";
const ROLES = ["media", "site", "api"];

const srcText = readFileSync(path.join(ROOT, "data/endpoints.json"), "utf8");
const src = JSON.parse(srcText);
const problems = [];

for (const role of ROLES) {
  const list = src.roles?.[role]?.candidates;
  if (!Array.isArray(list) || !list.length) { problems.push(`真源缺角色 ${role}`); continue; }
  for (const h of list) {
    if (!/^https:\/\/[a-z0-9.-]+\/$/.test(h)) problems.push(`${role}: 候选域要写成 https://主机名/ ：${h}`);
    // 2026-10-01 国内多节点实测 0/24，写进候选表只会白白拖慢探测
    if (/\.workers\.dev\/$/.test(h)) problems.push(`${role}: *.workers.dev 国内整段不通，别写进候选表：${h}`);
  }
}

const urls = (s) => [...s.matchAll(/"(https:\/\/[^"]+)"/g)].map((m) => m[1]);
function builtin(file, pattern) {
  const text = readFileSync(path.join(ROOT, file), "utf8");
  const out = {};
  for (const role of ROLES) {
    const m = text.match(pattern(role));
    out[role] = m ? urls(m[1]) : null;
  }
  return out;
}
const tables = {
  "apps/askbible-ios/AskBible/Model/Endpoints.swift": (role) => new RegExp(`case \\.${role}:\\s*return \\[([^\\]]*)\\]`),
  "apps/askbible-android/core/src/main/kotlin/me/askbible/native_/data/Endpoints.kt": (role) =>
    new RegExp(`${role.toUpperCase()}\\("${role}", listOf\\(([^)]*)\\)\\)`),
};
for (const [file, pattern] of Object.entries(tables)) {
  const got = builtin(file, pattern);
  for (const role of ROLES) {
    const want = src.roles?.[role]?.candidates ?? [];
    if (JSON.stringify(got[role]) !== JSON.stringify(want)) {
      problems.push(`${file} 的 ${role} 内置表和真源不一致：\n    内置 ${JSON.stringify(got[role])}\n    真源 ${JSON.stringify(want)}`);
    }
  }
}

const pub = path.join(ROOT, "public/endpoints.json");
if (CHECK) {
  if (!existsSync(pub) || readFileSync(pub, "utf8") !== srcText) problems.push("public/endpoints.json 和真源不一致，跑 npm run gen:endpoints");
} else {
  writeFileSync(pub, srcText);
}

if (problems.length) {
  console.error("候选域表对拍失败：\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`候选域表一致：${ROLES.map((r) => `${r} ${src.roles[r].candidates.length} 条`).join(" · ")}`);

if (PUSH) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "askbible-endpoints-"));
  const healthz = path.join(tmp, "healthz.txt");
  writeFileSync(healthz, "ok\n");
  const put = (file, key, type) => {
    const res = spawnSync("npx", ["--no-install", "wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--file", file,
      "--content-type", type, "--cache-control", "public, max-age=60", "--remote"], { cwd: ROOT, encoding: "utf8" });
    if (res.status !== 0) throw new Error(`上传失败 ${key}：${(res.stderr || res.stdout || "").slice(0, 400)}`);
    console.log(`已上传 ${BUCKET}/${key}`);
  };
  put(path.join(ROOT, "data/endpoints.json"), "endpoints.json", "application/json; charset=utf-8");
  put(healthz, "healthz.txt", "text/plain; charset=utf-8");
}
