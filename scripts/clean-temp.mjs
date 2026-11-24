#!/usr/bin/env node
/**
 * 构建后轻量临时文件自动清理脚本（规范：所有项目可再生重型缓存统一外置到 APP/TEMP/AskBible-TEMP/）
 *
 * 原则：保留增量加速缓存，仅清理过期垃圾与临时日志：
 * - 保留：node_modules、.next/cache（及最新 .next 构建）、.cache、.wrangler、.cloudflare、.vinext、android-.gradle
 * - 清理：超过 7 天的非活跃 .worktrees/（跳过活跃注册工作树）、构建日志（*.log）、临时文件（*.tmp / tmp-*）、coverage/、test-results/
 *
 * 用法：
 *   node scripts/clean-temp.mjs            # 默认清理超过 7 天的过期项与日志
 *   node scripts/clean-temp.mjs --days=3   # 自定义过期天数
 *   node scripts/clean-temp.mjs --dry-run  # 仅预览不删除
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const daysArg = args.find((a) => a.startsWith('--days='));
const parsedDays = daysArg ? Number(daysArg.slice('--days='.length)) : 7;
const MAX_AGE_DAYS = Number.isFinite(parsedDays) && parsedDays >= 0 ? parsedDays : 7;
const CUTOFF_MS = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

const removed = [];

function safeRealpath(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

function getActiveWorktreePaths() {
  const active = new Set();
  try {
    const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let currentPath = null;
    let isPrunable = false;
    const flush = () => {
      if (currentPath && !isPrunable) {
        const real = safeRealpath(currentPath);
        active.add(path.resolve(currentPath));
        if (real) active.add(real);
      }
      currentPath = null;
      isPrunable = false;
    };
    for (const line of out.split('\n')) {
      if (line.startsWith('worktree ')) {
        flush();
        currentPath = line.slice('worktree '.length).trim();
      } else if (line.startsWith('prunable')) {
        isPrunable = true;
      } else if (line.trim() === '') {
        flush();
      }
    }
    flush();
  } catch {
    // 非 git 仓库或 git 不可用时跳过
  }
  return active;
}

function removeTarget(targetPath, label) {
  if (dryRun) {
    removed.push(`[dry-run] ${label}`);
    return;
  }
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
    removed.push(label);
  } catch {
    // 清理脚本永不阻断正常构建
  }
}

// 1. 清理已失效的 git worktree 元数据，并删除超过 MAX_AGE_DAYS 天的非活跃 .worktrees 子目录
try {
  if (!dryRun) {
    execFileSync('git', ['worktree', 'prune'], { cwd: ROOT, stdio: 'ignore' });
  }
} catch {
  // ignore
}

const worktreesDir = safeRealpath(path.join(ROOT, '.worktrees'));
if (worktreesDir && fs.existsSync(worktreesDir)) {
  const activeWorktrees = getActiveWorktreePaths();
  for (const ent of fs.readdirSync(worktreesDir, { withFileTypes: true })) {
    if (ent.name === '.DS_Store') continue;
    const full = path.join(worktreesDir, ent.name);
    const linked = path.join(ROOT, '.worktrees', ent.name);
    if (activeWorktrees.has(full) || activeWorktrees.has(linked)) continue;
    try {
      const stat = fs.lstatSync(full);
      if (stat.mtimeMs < CUTOFF_MS) {
        removeTarget(full, `.worktrees/${ent.name}`);
      }
    } catch {
      // ignore
    }
  }
}

// 2. 清理项目根目录与外置 TEMP 根目录下的构建日志、临时文件与覆盖率输出（严守增量缓存不删）
const tempRoots = new Set([ROOT]);
const nodeModulesReal = safeRealpath(path.join(ROOT, 'node_modules'));
if (nodeModulesReal) {
  const maybeTempRoot = path.dirname(nodeModulesReal);
  if (maybeTempRoot !== ROOT && path.basename(maybeTempRoot).endsWith('-TEMP')) {
    tempRoots.add(maybeTempRoot);
  }
}

const TEMP_FILE_RE = /^(?:npm-debug\.log.*|yarn-debug\.log.*|yarn-error\.log.*|pnpm-debug\.log.*|tmp-.*|.*\.(?:log|tmp))$/i;
const KEEP_NAMES = new Set([
  'node_modules',
  '.next',
  '.cache',
  '.wrangler',
  '.worktrees',
  '.cloudflare',
  '.vinext',
  'android-.gradle',
  'ios-build',
  'workers-askbible-sync-.wrangler',
  'workers-site-proxy-.wrangler',
]);

for (const dir of tempRoots) {
  if (!fs.existsSync(dir)) continue;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (KEEP_NAMES.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.name === 'coverage' || ent.name === 'test-results') {
      removeTarget(full, path.relative(ROOT, full) || ent.name);
      continue;
    }
    if (TEMP_FILE_RE.test(ent.name)) {
      removeTarget(full, ent.name);
    }
  }
}

// 3. 清理 dist/mobile 下散落的过期 APK/IPA 临时包（遵循 AGENTS.md 打包产物用完即删原则）
const distMobileDir = path.join(ROOT, 'dist', 'mobile');
if (fs.existsSync(distMobileDir)) {
  for (const ent of fs.readdirSync(distMobileDir, { withFileTypes: true })) {
    if (ent.name === '.DS_Store') continue;
    const full = path.join(distMobileDir, ent.name);
    try {
      const stat = fs.lstatSync(full);
      if (stat.mtimeMs < CUTOFF_MS) {
        removeTarget(full, `dist/mobile/${ent.name}`);
      }
    } catch {
      // ignore
    }
  }
}

if (removed.length > 0) {
  console.log(`🧹 clean-temp: cleaned ${removed.length} item(s): ${removed.join(', ')}`);
} else {
  console.log(`🧹 clean-temp: clean (0 expired items, threshold ${MAX_AGE_DAYS}d)`);
}
