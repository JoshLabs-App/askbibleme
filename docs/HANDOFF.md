# AskBible.me — AI 交接开发文档

**用途**：AI / Agent 接手本仓库时的**唯一启动地图**。先读本文，再按需下钻；不要通读全库。  
**基线更新**：2026-11-27（已定案 **D-47**：10% 原生骨架触感壳 + 90% 纯 Vite 静态内核 + 文件级 SHA-256 无感热更 + 去 Next.js + 清退 Studio，多线程并行契约见 `docs/UNIFIED-KERNEL-PARALLEL-PLAN.md`；前期基线 `5bbc3aad` 线上运行中）  
**仓库**：`/Users/joshua/Desktop/APP/圣经项目/01AskBible`（重缓存软链外置至 `/Users/joshua/Desktop/APP/TEMP/AskBible-TEMP/`）  
**对外名称**：**AskBible.me**（域名 `askbible.me`）。内部名 `selah-*`、包名 `me.askbible` **不得**出现在用户界面。

---

## 0. 启动顺序（强制）

| 步 | 文件 | 用途 |
|----|------|------|
| 1 | `/Users/joshua/Desktop/APP/skills/joshlabs-dev/SKILL.md` 与 `references/core-dev-principles.md` | 通用完整交付流程与极轻架构准则 |
| 2 | `AGENTS.md` 与 `docs/DECISIONS.md`（重点看末尾 D-44 ~ D-46） | 产品边界、架构总纲与发布授权真源 |
| 3 | 本文 `docs/HANDOFF.md` + `docs/CODE_MAP.md` + `docs/ARCHITECTURE.md` | 现行仓库地图、精确行号导航与拆巨石接口契约 |
| 4 | `.cursor/rules/*.mdc` 与 `docs/09-dangerous-directions.md` | 领域硬约束与产品防跑偏红线 |

用户说 **`DD`** = 在已授权范围内继续推进到验收与发布完成；正常任务无需等 `DD`。

---

## 1. 产品定位与现行架构（D-44 / D-45 / D-46）

- **是什么**：一个让人**重新进入圣经的安静入口**（羊皮卷实底质感、去游戏化藏书票、低认知负荷）。
- **不是什么**：不是 Bible Tool、不是 AI Chatbot、不是游戏化刷分 App、不是百科平台。
- **全端统一版面（D-45）**：iOS / Android / Web 全面对齐安卓羊皮卷实底版面（五栏纯图标底栏：首页 · 全景 · 读经计划 · 圣经 · 探索；整宽贴底播放坞；彻底停用苹果 Liquid Glass）。
- **云端单栈（零 Vercel / 零 Supabase / 零 Render）**：
  - **Web 主站 Worker**：`askbible-web`（`vinext` + Cloudflare Workers，配置见 `cloudflare.config.ts`，通过 Service Binding 内网直连 `ASKBIBLE_SYNC`）。
  - **认证与同步 Worker**：`workers/askbible-sync`（纯 JS + Cloudflare D1；6 位邮箱 OTP + Apple/Google 原生 ID Token JWKS 公钥直验；服务端单点执行同步合并）。
  - **媒体与离线包**：Cloudflare R2 `askbible-media`（自定义域 `media.askbible.me` + 永久兼容旧公开域 `pub-f30fb48025d841f09c37bb9b52df5354.r2.dev`）。
  - **离线包热更与自动升级（D-46）**：`PackStore` 校验 `v2/catalog.json` 的 `SHA-256` 与 SQLite 100 字节页头静默原子热更；侧边抽屉内置「检查更新」与客户端版本自检。
- **Studio**：本机产品大脑（`/studio`，仅 `npm run dev` 本地使用，线上生产环境默认 `404`）。

---

## 2. 仓库地图（已清退历史遗产）

```text
01AskBible/
├── AGENTS.md                 # 产品哲学、架构总纲与发布授权真源
├── cloudflare.config.ts      # Web Worker (askbible-web) 配置与 Service Bindings
├── vite.config.ts            # vinext / Cloudflare Vite 构建配置
├── apps/
│   ├── askbible-ios/         # 原生 iOS (Swift / Xcode, PackStore + NativeMediaBridge + 三路音频 + Widget)
│   └── askbible-android/     # 原生 Android (Kotlin / Gradle, PackStore + NativeMediaBridge + 三路音频 + Widget)
├── workers/
│   ├── askbible-sync/        # 会员认证 (OTP / OIDC JWKS) + 读经同步单点合并 Worker + D1 schema.sql
│   └── site-proxy/           # 域名边缘代理 Worker
├── app/ components/ lib/     # Web 端与共享数据/工具逻辑
├── data/                     # 本地真源数据（译本、计划、人物、勋章/藏书票、endpoints.json）
├── public/                   # 静态资源与构建生成的 v2/catalog.json
├── scripts/ tools/           # 构建预生成、代码地图 (gen-code-map.mjs)、缓存清理 (clean-temp.mjs)、直发与数据校验
├── docs/                     # CODE_MAP.md、ARCHITECTURE.md、产品原则 (01–11)、DECISIONS.md、OPEN-ITEMS.md
└── AA/                       # 本机签名凭证软链目录（严禁提交进 Git）
```

> 注：2026-11-20 之前的退役工程（Expo `apps/askbible-mobile`、Supabase、Vercel、Render、Maestro 及旧本地缓存）已全部归档移至 `/Users/joshua/Desktop/APP/00/archive/01AskBible-legacy-before-20261120/`。

---

## 3. 常用开发、验证与发布命令

```bash
# 本地开发与代码导航
npm run dev                  # http://localhost:3450
npm run map                  # 秒级扫描刷新 docs/CODE_MAP.md（pre-commit 自动执行）
npm run clean:temp           # 清理 >7d 非活跃 worktrees、日志与临时文件（保留增量缓存）

# 代码、色彩门禁与跨端数据验证
npm run sync:theme           # 从 lib/theme-palette.ts 同步单一色彩总表至 app/tokens.css
npm run check:colors         # 校验 app/tokens.css 与总表一致性及业务层零野生色值门禁
npm run check                # check:colors + 构建元信息 + tsc --noEmit + vitest 单测
npm run check:native         # endpoints / 藏书票 / 语言序 / 书卷目录 / 经文 / 音频 / 时间戳 / 计划全套校验

# 原生端编译与单测
cd apps/askbible-android && ./gradlew :core:test :app:compileDebugKotlin
cd apps/askbible-ios && xcodebuild -project AskBible.xcodeproj -scheme AskBible -configuration Debug -destination 'generic/platform=iOS Simulator' build

# 生产发布（本机构建直发 Cloudflare Workers，禁止云端自动构建）
npm run ship                 # bash scripts/deploy-direct.sh（构建并发布 askbible-web，发布后核对 /api/app-build）
npm run ship:sync            # 部署 workers/askbible-sync
```

---

## 4. 硬红线速查

1. **R2 旧地址保活**：`askbible-media` 桶名与 `pub-f30fb48025d841f09c37bb9b52df5354.r2.dev` 永久不可改名或关闭公开读。
2. **媒体不走主站 Worker**：大体积音频/视频/扩展包一律走 R2 + `Endpoints` 选线，禁止压到 `askbible-web`。
3. **打包产物用完即删**：本地 APK / IPA / AAB 及 `build/`、`DerivedData` 验收后及时清理，不污染工作区；切勿误删 `node_modules` 或 `AA/`。
4. **合入与提交纪律**：只提交本任务文件；合入 `main` 遵守 CI 门禁。

---

## 5. 附：2026-11-24 一期治理标配与二期首批超千行巨石拆分交接

- **当前状态**（代码与线上基线 `5bbc3aad`，`askbible-web` Worker Version `3713f957-9c2e-41cb-b00c-123a51e0b896`，`/api/app-build` 与 `/read/JHN/10` 浅/深色探活通过）：
  - **一期治理标配已上线（`1823761c`、`44f14bd8`）**：`AskBible-TEMP` 外置软链与 `clean-temp.mjs`、`docs/CODE_MAP.md` 自动钩子门禁、单一色彩总表 `lib/theme-palette.ts` → `app/tokens.css` 与 `check-hardcoded-colors.mjs`、底栏版本戳 + 静默热更（`AskBibleBottomUtilityBar.tsx`）、`Alt+Shift+C` 定位探针（`AskBibleCodeProbe.tsx`）、桌面 ⇄ 390×844 手机模型（`MobileModelStage.tsx`），以及 `MusicShellPlaybackContext.tsx`（1643 → 513 行）拆解。
  - **二期首批超千行巨石拆分与野色清零已审查 PASS 并上线（`5bbc3aad`）**：`read-chapter-surfaces.css`（3817 → 17 行 + `surfaces/01..09*.css` 13 个 ≤427 行模块，清零 498 处野生色值）、`studio-ai-discussion-panel.tsx`（1363 → 87 行 + 4 个 ≤378 行模块，清零野色）、`studio-workspace.tsx`（1285 → 270 行 + 5 个 ≤402 行模块）；`check:colors` 业务层存量冻结降至 109 文件 / 2261 处；`tsc --noEmit` 与 27 文件 / 140 项单测全绿（`npm run build` 已于发布前验证通过）。
- **下一步**：
  - 按 `docs/ARCHITECTURE.md` 排期继续拆解下一批超千行与 >800 行源码/样式模块：`ReadChapterVersesClient.tsx`（1172 行）、`NatureVideoExperience.tsx`（1197 行）、原生壳层 `MainActivity.kt`（1435 行）与 `AskBibleApp.swift`（1236 行），以及 `bible-catalog.css`（1226 行）、`music-home.css`（1188 行）等。
