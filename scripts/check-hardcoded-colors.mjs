#!/usr/bin/env node
/**
 * AskBible.me 全站单一系统色彩总表 · 业务层零野生色值硬门禁（JOSHUA 2026-11-23）
 *
 * 规则：
 * 1. 全站系统配色唯一真源：lib/theme-palette.ts → app/tokens.css（及站点预设派生器 lib/site-branding-colors.ts）
 * 2. 业务页面、组件与 CSS 严禁新增硬编码 #hex / rgb() / hsl()（含 var(--x, #hex) 裸色兜底），统一引用 var(--ab-*) 或 var(--brand-*)。
 * 3. 仅色彩总表真源、物理荧光笔颜料与藏书票金属色卡、单测文件显式豁免。
 * 4. 新文件 0 容忍；历史存量受 scripts/legacy-color-budgets.json 冻结水位线约束（只许收编减少，严禁反弹）。
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const budgetPath = resolve(root, "scripts/legacy-color-budgets.json");
const scanRoots = ["app", "components", "hooks", "lib"];

// 显式白名单：唯一色彩总表真源、物理颜料/藏书票金属色卡、测试文件
const EXEMPT_PATH_RE =
  /(?:^|\/)__tests__\/|\.(?:test|spec)\.|^app\/tokens\.css$|^lib\/theme-palette\.ts$|^lib\/site-branding-colors\.ts$|^lib\/read\/read-verse-text-highlights\.ts$|^lib\/read\/read-parchment-accents\.ts$|^lib\/achievements\/medal/i;

const COLOR_RE =
  /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\brgba?\(\s*(?!var\()[^)\n]+\)|\bhsla?\(\s*(?!var\()[^)\n]+\)/g;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".DS_Store") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(css|ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

function countWildColors(filePath) {
  const src = readFileSync(filePath, "utf8");
  let count = 0;
  let inBlockComment = false;
  for (const rawLine of src.split("\n")) {
    let line = rawLine;
    if (inBlockComment) {
      const endIdx = line.indexOf("*/");
      if (endIdx < 0) continue;
      line = line.slice(endIdx + 2);
      inBlockComment = false;
    }
    while (true) {
      const startIdx = line.indexOf("/*");
      if (startIdx < 0) break;
      const endIdx = line.indexOf("*/", startIdx + 2);
      if (endIdx < 0) {
        line = line.slice(0, startIdx);
        inBlockComment = true;
        break;
      }
      line = line.slice(0, startIdx) + " " + line.slice(endIdx + 2);
    }
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    const stripped = trimmed.replace(/(^|[^:])\/\/.*$/, "$1");
    const matches = stripped.match(COLOR_RE);
    if (matches) count += matches.length;
  }
  return count;
}

const t0 = performance.now();
const files = scanRoots.flatMap((r) => walk(resolve(root, r)));
const counts = {};
let scanned = 0;

for (const abs of files) {
  const rel = relative(root, abs).replaceAll("\\", "/");
  if (EXEMPT_PATH_RE.test(rel)) continue;
  scanned += 1;
  const n = countWildColors(abs);
  if (n > 0) counts[rel] = n;
}

if (process.argv.includes("--update-budgets")) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(budgetPath, JSON.stringify(sorted, null, 2) + "\n", "utf8");
  const total = Object.values(sorted).reduce((a, b) => a + b, 0);
  console.log(`✅ 已更新存量野生色值冻结水位线: ${Object.keys(sorted).length} 个文件，共 ${total} 处`);
  process.exit(0);
}

const budgets = existsSync(budgetPath) ? JSON.parse(readFileSync(budgetPath, "utf8")) : {};
const violations = [];
const tightened = [];

for (const [rel, n] of Object.entries(counts)) {
  const max = budgets[rel] ?? 0;
  if (n > max) {
    violations.push(
      max === 0
        ? `  - [禁止新增野生色值] ${rel} 含 ${n} 处硬编码色值（#hex/rgb/hsl），请改用 var(--ab-*) / var(--brand-*) 或在 lib/theme-palette.ts 统一登记`
        : `  - [存量色值反弹] ${rel} 含 ${n} 处 > 冻结上限 ${max} 处（只许收编减少，严禁新增野生色值）`,
    );
  } else if (n < max) {
    tightened.push(`${rel}: ${max}→${n}`);
  }
}

if (violations.length > 0) {
  console.error("❌ 业务层零野生色值门禁未通过：\n" + violations.join("\n"));
  process.exit(1);
}

const ms = (performance.now() - t0).toFixed(1);
const legacyCount = Object.keys(counts).length;
const legacyTotal = Object.values(counts).reduce((a, b) => a + b, 0);
const bonus = tightened.length ? ` · 本次收编减少 ${tightened.length} 个文件` : "";
console.log(
  `✅ 业务层零野生色值门禁通过（扫描 ${scanned} 个业务文件 · 存量冻结 ${legacyCount} 文件/${legacyTotal} 处${bonus}，耗时 ${ms}ms）`,
);
