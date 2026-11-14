// Only public build values are supplemented locally; server secrets stay on Vercel.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const [root, output, sha] = process.argv.slice(2);
const envPath = path.join(output, '.vercel/.env.production.local');
const env = dotenv.parse(fs.readFileSync(envPath));
const localPath = path.join(root, '.env.web-build.local');
const local = fs.existsSync(localPath) ? dotenv.parse(fs.readFileSync(localPath)) : {};
for (const [key, value] of Object.entries(env)) {
  if (!value.includes('[SENSITIVE]')) continue;
  if (key.startsWith('NEXT_PUBLIC_')) {
    if (!local[key] || local[key].includes('[SENSITIVE]')) throw new Error(`Missing local public build value: ${key}`);
    env[key] = local[key];
  } else delete env[key];
}
for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_MEMBER_REGISTER_ENABLED']) {
  if (!env[key]) throw new Error(`Missing public build value: ${key}`);
}
delete env.VERCEL_DEPLOYMENT_ID;
env.VERCEL_GIT_COMMIT_SHA = sha;
fs.writeFileSync(envPath, Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', {mode: 0o600});
const projectPath = path.join(output, '.vercel/project.json');
const project = JSON.parse(fs.readFileSync(projectPath));
project.settings = {...project.settings, installCommand: 'true'};
fs.writeFileSync(projectPath, JSON.stringify(project));
console.log('Local public build configuration ready; server-only sensitive values deferred to runtime.');
