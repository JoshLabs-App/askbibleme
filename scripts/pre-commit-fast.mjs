#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const t0 = performance.now();
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const stagedRaw = execFileSync(
  'git',
  ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
  { cwd: rootDir, encoding: 'utf8' },
);
const stagedFiles = stagedRaw
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

if (stagedFiles.length === 0) {
  process.exit(0);
}

// 1. 自动刷新代码导航地图（秒级），保证 docs/CODE_MAP.md 与本次提交源码 100% 同步对齐
const mapRes = spawnSync(process.execPath, [resolve(rootDir, 'scripts/gen-code-map.mjs')], {
  cwd: rootDir,
  stdio: 'inherit',
});
if ((mapRes.status ?? 1) !== 0) {
  process.exit(mapRes.status ?? 1);
}
if (existsSync(resolve(rootDir, 'docs/CODE_MAP.md'))) {
  execFileSync('git', ['add', '--', 'docs/CODE_MAP.md'], { cwd: rootDir });
}

// 2. 单一系统色彩总表与业务层零硬编码色值门禁（~60ms）
const tokenSyncRes = spawnSync(
  process.execPath,
  [resolve(rootDir, 'node_modules/tsx/dist/cli.mjs'), resolve(rootDir, 'scripts/sync-theme-tokens.mjs'), '--check'],
  { cwd: rootDir, stdio: 'inherit' },
);
if ((tokenSyncRes.status ?? 1) !== 0) {
  process.exit(tokenSyncRes.status ?? 1);
}

const colorRes = spawnSync(process.execPath, [resolve(rootDir, 'scripts/check-hardcoded-colors.mjs')], {
  cwd: rootDir,
  stdio: 'inherit',
});
if ((colorRes.status ?? 1) !== 0) {
  process.exit(colorRes.status ?? 1);
}

// 3. 暂存 TS/TSX/JS/MJS 秒级语法速检（esbuild transformSync + node --check）
const tsFiles = stagedFiles.filter(
  (rel) => /\.(ts|tsx|mts)$/.test(rel) && !rel.endsWith('.d.ts') && existsSync(resolve(rootDir, rel)),
);
const jsFiles = stagedFiles.filter(
  (rel) => /\.(js|mjs)$/.test(rel) && existsSync(resolve(rootDir, rel)),
);

const syntaxErrors = [];

if (tsFiles.length > 0) {
  const { transformSync } = await import('esbuild');
  for (const rel of tsFiles) {
    const abs = resolve(rootDir, rel);
    const code = readFileSync(abs, 'utf8');
    const loader = rel.endsWith('.tsx') ? 'tsx' : 'ts';
    try {
      transformSync(code, { loader, sourcefile: rel, logLevel: 'silent' });
    } catch (err) {
      if (Array.isArray(err?.errors) && err.errors.length > 0) {
        for (const item of err.errors) {
          const loc = item.location
            ? `${item.location.file || rel}:${item.location.line}:${item.location.column}`
            : rel;
          syntaxErrors.push(`${loc} - ${item.text}`);
        }
      } else {
        syntaxErrors.push(`${rel} - ${err?.message ?? String(err)}`);
      }
    }
  }
}

for (const rel of jsFiles) {
  const chk = spawnSync(process.execPath, ['--check', resolve(rootDir, rel)], {
    cwd: rootDir,
    encoding: 'utf8',
  });
  if ((chk.status ?? 1) !== 0) {
    syntaxErrors.push(`${rel} - ${(chk.stderr || chk.stdout || 'JS syntax error').trim()}`);
  }
}

if (syntaxErrors.length > 0) {
  console.error('❌ [pre-commit] 暂存文件存在语法错误，已拦截提交：');
  for (const msg of syntaxErrors) {
    console.error(`  ${msg}`);
  }
  process.exit(1);
}

const elapsedMs = Math.round(performance.now() - t0);
console.log(
  `✅ [pre-commit] 代码地图、零硬编码色彩门禁与语法校验通过 (暂存 ${stagedFiles.length} 个文件，TS/JS ${tsFiles.length + jsFiles.length} 个，耗时 ${elapsedMs}ms)`,
);
