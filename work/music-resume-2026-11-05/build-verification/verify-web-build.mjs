// Reproduce the repository's isolated local build convention, without deployment.
// Run from the repository root. Only existing public build values are copied.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const dotenv = require('dotenv');
const evidence = path.join(root, 'work/music-resume-2026-11-05/build-verification');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'askbible-music-web-build-'));
fs.writeFileSync(path.join(evidence, 'stage-path.txt'), stage + '\n');
const inputs = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {cwd:root, encoding:'utf8'}).split('\0').filter(Boolean);
const excluded = new Set(['apps', 'work', 'generated_images', '.agents', '.codex', '.git', '.claude', '.vercel']);
const manifest = [];
for (const file of [...new Set(inputs)].sort()) {
  if (excluded.has(file.split('/')[0]) || path.basename(file).startsWith('.env')) continue;
  const source = path.join(root, file);
  if (!fs.existsSync(source) || !fs.lstatSync(source).isFile()) continue;
  const target = path.join(stage, file);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.copyFileSync(source, target, fs.constants.COPYFILE_FICLONE);
  manifest.push({file, sha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')});
}
const publicConfig = dotenv.parse(fs.readFileSync(path.join(root, '.env.web-build.local')));
const keys = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_MEMBER_REGISTER_ENABLED'];
const lines = keys.map(key => {
  const value = publicConfig[key];
  if (!value || value.includes('[SENSITIVE]')) throw new Error(`Missing existing public build configuration: ${key}`);
  return `${key}=${JSON.stringify(value)}`;
});
fs.writeFileSync(path.join(stage, '.env.production.local'), lines.join('\n') + '\n', {mode:0o600});
fs.writeFileSync(path.join(evidence, 'source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
execFileSync('/bin/cp', [process.platform === 'darwin' ? '-cR' : '-a', path.join(root, 'node_modules'), path.join(stage, 'node_modules')]);
console.log(`Prepared isolated source snapshot (${manifest.length} files): ${stage}`);
console.log('Preserved original local database and environment symlink. Running full npm run build, including prebuild.');
const started = Date.now();
const result = spawnSync('npm', ['run', 'build'], {cwd:stage, stdio:'inherit', env:{...process.env, VERCEL_ENV:'production', NEXT_TELEMETRY_DISABLED:'1'}});
const summary = {stage, exitCode:result.status, elapsedSeconds:Math.round((Date.now()-started)/1000), node:process.version, sourceFiles:manifest.length, published:false};
fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify(summary, null, 2) + '\n');
if (result.error) console.error(result.error.message);
console.log(JSON.stringify(summary));
process.exitCode = result.status ?? 1;
