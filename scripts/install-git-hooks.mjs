#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(resolve(rootDir, '.git'))) {
  process.exit(0);
}

const hookRel = execFileSync('git', ['rev-parse', '--git-path', 'hooks/pre-commit'], {
  cwd: rootDir,
  encoding: 'utf8',
}).trim();
const hookPath = resolve(rootDir, hookRel);

mkdirSync(dirname(hookPath), { recursive: true });
writeFileSync(hookPath, '#!/bin/sh\nexec node scripts/pre-commit-fast.mjs\n', 'utf8');
chmodSync(hookPath, 0o755);

console.log(`✅ Git pre-commit hook 已安装: ${hookPath}`);
