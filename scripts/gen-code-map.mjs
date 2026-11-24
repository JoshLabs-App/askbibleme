#!/usr/bin/env node
/**
 * 自动生成 docs/CODE_MAP.md（AskBible.me 全局零盲搜代码导航地图）
 * 用法：
 *   npm run map                    # 秒级重扫全仓并刷新 docs/CODE_MAP.md
 *   node scripts/gen-code-map.mjs --check  # CI 校验 docs/CODE_MAP.md 是否与源码同步
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readLines(rel) {
  const full = resolve(root, rel);
  if (!existsSync(full)) return [];
  return readFileSync(full, 'utf8').replace(/\r\n/g, '\n').split('\n');
}

function countLines(rel) {
  const full = resolve(root, rel);
  if (!existsSync(full)) return 0;
  const raw = readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
  if (raw.length === 0) return 0;
  const parts = raw.split('\n');
  return raw.endsWith('\n') ? parts.length - 1 : parts.length;
}

function walkFiles(dirRel, filterFn) {
  const absDir = resolve(root, dirRel);
  if (!existsSync(absDir)) return [];
  const results = [];
  const visit = (curAbs, curRel) => {
    const entries = readdirSync(curAbs, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const ent of entries) {
      if (
        ent.name === 'node_modules' ||
        ent.name === '.git' ||
        ent.name === '.next' ||
        ent.name === 'build' ||
        ent.name === 'DerivedData' ||
        ent.name.startsWith('.gradle') ||
        ent.name.startsWith('.wrangler') ||
        ent.name === '.DS_Store'
      ) {
        continue;
      }
      const nextAbs = resolve(curAbs, ent.name);
      const nextRel = posix.join(curRel, ent.name);
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) {
        visit(nextAbs, nextRel);
      } else if (ent.isFile() && (!filterFn || filterFn(nextRel, ent.name))) {
        results.push(nextRel);
      }
    }
  };
  visit(absDir, dirRel);
  return results.sort((a, b) => a.localeCompare(b));
}

function routePathFromPageRel(pageRel) {
  const trimmed = pageRel.replace(/^app\//, '').replace(/\/page\.tsx$/, '');
  const segs = trimmed
    .split('/')
    .filter((s) => s && !(s.startsWith('(') && s.endsWith(')')));
  return '/' + segs.join('/');
}

function scanAppPagesAndApis() {
  const files = walkFiles('app', (rel, name) => name === 'page.tsx' || name === 'route.ts');
  const pages = [];
  const apis = [];
  for (const rel of files) {
    if (rel.endsWith('/page.tsx')) {
      const urlPath = routePathFromPageRel(rel);
      const groupMatch = rel.match(/^app\/(\([^)]+\))/);
      const shellTag = groupMatch ? ` ${groupMatch[1]}` : '';
      pages.push(`| \`${urlPath}\`${shellTag} | \`${rel}\` |`);
    } else if (rel.endsWith('/route.ts')) {
      const urlPath = '/' + rel.replace(/^app\//, '').replace(/\/route\.ts$/, '');
      const lines = readLines(rel);
      const methods = [];
      for (const line of lines) {
        const m = line.match(
          /^export\s+(?:(?:async\s+)?function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/,
        );
        if (m && !methods.includes(m[1])) methods.push(m[1]);
      }
      const methodStr = methods.length > 0 ? methods.map((x) => `\`${x}\``).join(' ') : '-';
      apis.push(`| \`${urlPath}\` | ${methodStr} | \`${rel}\` |`);
    }
  }
  return { pages, apis };
}

function scanSyncWorkerEndpoints() {
  const rel = 'workers/askbible-sync/src/index.js';
  const lines = readLines(rel);
  const endpoints = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\s*if\s*\(/.test(line)) continue;
    const methodMatch = line.match(/request\.method\s*===\s*"([A-Z]+)"/);
    const method = methodMatch ? methodMatch[1] : 'ANY';
    for (const pm of line.matchAll(/path\s*===\s*"([^"]+)"/g)) {
      const p = pm[1];
      const key = `${method} ${p}`;
      if (!seen.has(key)) {
        seen.add(key);
        endpoints.push(`- \`${method} ${p}\` → \`${rel}\`(L${i + 1})`);
      }
    }
  }
  return endpoints;
}

function scanD1SchemaTables(schemaRel) {
  const lines = readLines(schemaRel);
  const tables = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/i);
    if (!m) continue;
    const tableName = m[1];
    const startLine = i + 1;
    let pk = '';
    const cols = [];
    for (let j = i + 1; j < lines.length; j++) {
      const clean = lines[j].replace(/--.*$/, '').trim();
      if (/^\)\s*;/.test(clean)) {
        i = j;
        break;
      }
      const pkMatch = clean.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        pk = pkMatch[1].replace(/\s+/g, ' ').trim();
        continue;
      }
      const colMatch = clean.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:TEXT|INTEGER|REAL|BLOB|NUMERIC)\b(.*)$/i);
      if (colMatch) {
        cols.push(colMatch[1]);
        if (/\bPRIMARY\s+KEY\b/i.test(colMatch[2])) pk = colMatch[1];
      }
    }
    const summary =
      cols.slice(0, 8).map((c) => `\`${c}\``).join(', ') +
      (cols.length > 8 ? ` 等 ${cols.length} 列` : '');
    tables.push(`| \`${tableName}\` | L${startLine} | \`${pk || '-'}\` | ${summary} |`);
  }
  return tables;
}

function scanSubdirSummary(baseRel) {
  const abs = resolve(root, baseRel);
  if (!existsSync(abs)) return [];
  const dirs = readdirSync(abs, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
  return dirs.map((d) => {
    const files = walkFiles(`${baseRel}/${d}`, (rel) => /\.(ts|tsx|js|mjs|mts)$/.test(rel));
    return `\`${baseRel}/${d}/\`(${files.length})`;
  });
}

function scanToolsToolchain() {
  const out = [];
  for (const rel of readdirSync(resolve(root, 'tools')).sort((a, b) => a.localeCompare(b))) {
    if (!/\.(mjs|mts|py)$/.test(rel)) continue;
    const fullRel = `tools/${rel}`;
    const lines = readLines(fullRel);
    let desc = '';
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const cleaned = lines[i].replace(/^(\/\/|\s*\*|#)\s*/, '').trim();
      if (cleaned && !cleaned.startsWith('!') && !cleaned.startsWith('import ') && cleaned.length > 4) {
        desc = cleaned.slice(0, 72);
        break;
      }
    }
    out.push(`| \`${fullRel}\` | ${countLines(fullRel)} | ${desc || '-'} |`);
  }
  return out;
}

function extractSymbolAnchors(rel) {
  const lines = readLines(rel);
  const anchors = [];
  const isSwift = rel.endsWith('.swift');
  const isKt = rel.endsWith('.kt');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let label = null;

    if (isSwift) {
      const m = line.match(
        /^\s*(?:public\s+|private\s+|internal\s+|final\s+|@MainActor\s+)*(struct|class|enum|func)\s+([A-Za-z0-9_]+)/,
      );
      if (
        m &&
        (line.startsWith('struct ') ||
          line.startsWith('final class ') ||
          line.startsWith('class ') ||
          line.startsWith('enum ') ||
          /^ {0,4}(?:@MainActor\s+)?(?:private\s+)?func\s+/.test(line))
      ) {
        label = `\`${m[1]} ${m[2]}\``;
      }
    } else if (isKt) {
      const m = line.match(
        /^\s*(?:private\s+|internal\s+|suspend\s+|override\s+)*(class|object|interface|fun)\s+([A-Za-z0-9_]+)/,
      );
      if (
        m &&
        /^ {0,4}(?:private\s+|internal\s+|suspend\s+|override\s+)*(?:class|object|interface|fun)\s+/.test(line)
      ) {
        label = `\`${m[1]} ${m[2]}\``;
      }
    } else {
      const mExportFn = line.match(/^export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/);
      const mFn = line.match(/^(?:async\s+)?function\s+([A-Za-z0-9_]+)/);
      const mType = line.match(/^export\s+(type|interface)\s+([A-Za-z0-9_]+)/);
      const mConst = line.match(/^(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*(?::[^=]+)?=/);
      const mInnerHook = line.match(/^\s{2}const\s+([a-z][A-Za-z0-9_]+)\s*=\s*(?:useCallback|async\s*\()/);
      if (mExportFn) label = `\`export function ${mExportFn[1]}\``;
      else if (mType) label = `\`export ${mType[1]} ${mType[2]}\``;
      else if (mFn) label = `\`function ${mFn[1]}\``;
      else if (mConst && /^[A-Z0-9_]{3,}$/.test(mConst[1])) label = `\`const ${mConst[1]}\``;
      else if (mConst && line.startsWith('export const ')) label = `\`export const ${mConst[1]}\``;
      else if (mInnerHook) label = `\`${mInnerHook[1]}\` (callback/handler)`;
    }

    if (label) {
      anchors.push(`- \`L${i + 1}\` — ${label}`);
      if (anchors.length >= 24) break;
    }
  }
  return anchors;
}

function scanLargeFiles(threshold = 800) {
  const roots = ['app', 'components', 'lib', 'hooks', 'workers', 'tools', 'scripts', 'apps'];
  const allFiles = [];
  for (const r of roots) {
    const found = walkFiles(r, (rel) =>
      /\.(ts|tsx|js|mjs|mts|swift|kt)$/.test(rel) &&
      !rel.endsWith('.d.ts') &&
      !rel.includes('legacy-figure-articles-en-bundle'),
    );
    for (const rel of found) {
      const total = countLines(rel);
      if (total > threshold) {
        allFiles.push({ rel, total });
      }
    }
  }
  allFiles.sort((a, b) => b.total - a.total || a.rel.localeCompare(b.rel));
  return allFiles.map(({ rel, total }) => {
    const anchors = extractSymbolAnchors(rel);
    const body = anchors.length > 0 ? anchors.join('\n') : '- （纯数据/静态配置表，按需分段读取）';
    return `### \`${rel}\`（共 ${total} 行）\n${body}`;
  });
}

function scanMusicSubmodules() {
  const files = walkFiles('components/music', (rel) => /\.(ts|tsx)$/.test(rel));
  const playbackCore = files
    .filter((f) => f.includes('MusicShellPlaybackContext') || f.includes('music-shell-'))
    .map((rel) => `\`${rel}\`(${countLines(rel)}L)`);
  const musicUi = files
    .filter((f) => !f.includes('MusicShellPlaybackContext') && !f.includes('music-shell-'))
    .map((rel) => `\`${rel}\`(${countLines(rel)}L)`);
  return { playbackCore, musicUi };
}

const { pages, apis } = scanAppPagesAndApis();
const syncEndpoints = scanSyncWorkerEndpoints();
const d1Tables = scanD1SchemaTables('workers/askbible-sync/schema.sql');
const componentDirs = scanSubdirSummary('components');
const libDirs = scanSubdirSummary('lib');
const toolsRows = scanToolsToolchain();
const largeFileSections = scanLargeFiles(800);
const { playbackCore, musicUi } = scanMusicSubmodules();

const md = `# AskBible.me 全局代码导航地图（自动生成）

> 由 \`scripts/gen-code-map.mjs\` 自动扫描源码生成（运行 \`npm run map\` 秒级刷新；每次 \`git commit\` 自动对齐）。
> **AI 使用铁律**：先查本表定位文件与精确行号，按 \`start_line..end_line\` 精准读取 40–100 行，严禁盲目全仓搜索或整读千行大文件。拆巨石契约见 \`docs/ARCHITECTURE.md\`。

---

## 1. 核心业务域直达路由表（改什么功能直接去哪）

| 业务域 | 前端视图与状态（\`app/*\` / \`components/*\` / \`hooks/*\`） | 数据逻辑与后端（\`lib/*\` / \`workers/*\` / \`tools/*\`） | 验证命令 / 单测 |
| :--- | :--- | :--- | :--- |
| **三路音频与壳层播放（音乐 · 读经 · 金句）** | 壳层播放核：${playbackCore.join(' · ')}<br>全屏音乐页：${musicUi.join(' · ')} | 默认「安静」曲池：\`lib/music-companion/*\`<br>专辑推进：\`lib/music/album-playback.ts\` · \`lib/music/shell-music-advance.ts\`<br>媒体锁屏桥：\`lib/music/shell-media-session-web.ts\` | \`npm test\`<br>\`npm run check:chapter-audio\` |
| **圣经阅读 · 双语对照 · 译本与搜经** | 章页阅读：\`app/(app-shell)/read/[bookId]/[chapter]/page.tsx\`<br>经文渲染：\`components/bible/ReadChapterVersesClient.tsx\`<br>目录大纲：\`components/bible/BibleCatalogReadOutline.tsx\` | 译本选择：\`lib/bible/pick-translation-for-locale.ts\`<br>章节音频：\`lib/bible/read-chapter-audio.ts\`<br>静态分包：\`scripts/build-static-scripture.ts\` | \`npm run check:scripture-data\`<br>\`npm run check:book-catalog\` |
| **读经计划 · 今日跟读 · 灵修（Solid Joys）** | 计划总览：\`app/(app-shell)/read/plans/page.tsx\`<br>跟读播放：\`components/bible/ReadPlanPlayClient.tsx\`<br>灵修视图：\`components/bible/ReadPlanDevotional.tsx\` | 计划队列：\`lib/read/reading-plan-chapter-queue.ts\`<br>灵修交接：\`lib/devotional/solid-joys.ts\`<br>跟读时间轴：\`tools/build-verse-timings-db.mjs\` | \`npm run check:reading-plan\`<br>\`npm run check:verse-timings\` |
| **自然首页 · 金句轮播 · 羊皮卷五栏壳层（D-45）** | 首页/自然页：\`components/nature/NatureVideoExperience.tsx\`<br>首页仪表盘：\`components/home/HomeDashboard.tsx\`<br>金句轮播：\`components/home/HomeVerseRotator.tsx\` | 场景生成：\`tools/gen-nature-scenes.mjs\`<br>金句池：\`lib/daily-verse/*\` · \`lib/golden-verses/*\` | \`npm run check:endpoints\` |
| **探索 · 人物馆 · 历史信经 · 去游戏化藏书票** | 探索入口：\`app/(app-shell)/explore/page.tsx\`<br>人物馆：\`app/(app-shell)/explore/figures/page.tsx\`<br>藏书票：\`app/(app-shell)/explore/achievements/page.tsx\` | 人物数据：\`lib/figures/*\` · \`lib/legacy-figure-preview.ts\`<br>信经链接：\`lib/explore/historical-creeds-scripture-links.mjs\`<br>藏书票生成：\`tools/gen-medals.mjs\` | \`npm run check:medals\`<br>\`npm run check:explore-articles\` |
| **账号认证（OTP / Apple / Google）& 读经云同步（D-44）** | 登录页：\`app/(narrow-auth)/login/page.tsx\`<br>用户态：\`components/auth/AskbibleUserProvider.tsx\`<br>Web 代理：\`app/api/sync/[...path]/route.ts\` | 同步 Worker：\`workers/askbible-sync/src/index.js\`<br>JWKS 直验：\`workers/askbible-sync/src/jwks.js\`<br>单点合并：\`workers/askbible-sync/src/merge.js\`<br>Web 本地同步：\`lib/member-reading-sync/*\` | \`lib/askbible-web-auth-client.test.ts\` |
| **Studio 产品大脑（仅本机 \`npm run dev\`，线上 404）** | 工作台：\`app/studio/studio-workspace.tsx\`<br>AI 讨论区：\`app/studio/studio-ai-discussion-panel.tsx\` | 反思生成：\`app/studio/generate-ai-reflection.ts\`<br>上下文组装：\`lib/studio-ai-context.ts\`<br>生产门禁：\`middleware.ts\` · \`lib/selah-online-editor-surface.ts\` | \`npm test\` |
| **双端极薄原生壳 & 离线包热更（D-44 / D-46）** | Android：\`apps/askbible-android/app/src/main/java/me/askbible/native_/MainActivity.kt\`<br>iOS：\`apps/askbible-ios/AskBible/AskBibleApp.swift\` | 离线包构建：\`tools/build-web-pack.mjs\`<br>多域名选线：\`tools/endpoints-sync.mjs\`（\`data/endpoints.json\`）<br>CF 直发：\`scripts/deploy-direct.sh\` | \`npm run check:native\`<br>\`npm run check:web-pack\` |

- **\`components/*\` 模块分布**：${componentDirs.join(' · ')}
- **\`lib/*\` 模块分布**：${libDirs.join(' · ')}

---

## 2. >800 行源码文件精确行号目录（严禁整读，按 \`L<N>\` 直达）

${largeFileSections.join('\n\n')}

---

## 3. Cloudflare Workers & D1 数据库全图

### A. \`workers/askbible-sync\` 认证与读经同步路由（自动扫描 \`workers/askbible-sync/src/index.js\`）
${syncEndpoints.join('\n')}
- 边缘代理 Worker：\`workers/site-proxy/worker.js\`（白名单路径透传上游 + \`/healthz.txt\` 探针）
- Web 主站 Worker 配置：\`cloudflare.config.ts\`（Worker 名 \`askbible-web\`，Service Binding \`ASKBIBLE_SYNC\`）

### B. D1 数据库表结构速查（自动扫描 \`workers/askbible-sync/schema.sql\`）
| 表名 | 定义行号 | 主键 (PK) | 关键列摘要 |
| :--- | :--- | :--- | :--- |
${d1Tables.join('\n')}

---

## 4. Next.js / vinext 页面路由与 API 路由全表

### A. App Router 页面入口（共 ${pages.length} 个页面）
| URL 路径（含路由组） | 页面源文件 |
| :--- | :--- |
${pages.join('\n')}

### B. Web API 路由入口（共 ${apis.length} 个接口）
| API 路径 | HTTP 方法 | 路由源文件 |
| :--- | :--- | :--- |
${apis.join('\n')}

---

## 5. 跨端数据生成与自检工具链（\`tools/*\`）

| 脚本路径 | 行数 | 职责摘要 |
| :--- | :--- | :--- |
${toolsRows.join('\n')}
`;

const outPath = resolve(root, 'docs/CODE_MAP.md');
if (process.argv.includes('--check')) {
  const cur = existsSync(outPath) ? readFileSync(outPath, 'utf8').replace(/\r\n/g, '\n') : '';
  if (cur !== md) {
    console.error('❌ docs/CODE_MAP.md 已过期，与当前代码不一致，请运行 npm run map 刷新！');
    process.exit(1);
  }
  console.log(`✅ docs/CODE_MAP.md 与最新代码同步（${md.split('\n').length} 行）`);
} else {
  mkdirSync(resolve(root, 'docs'), { recursive: true });
  writeFileSync(outPath, md, 'utf8');
  console.log(`✅ 已更新 docs/CODE_MAP.md（${md.split('\n').length} 行）`);
}
