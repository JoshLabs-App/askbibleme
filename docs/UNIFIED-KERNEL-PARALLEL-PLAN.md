# AskBible.me · 同一内核多线程并行开发总纲（D-47）

> **用途**：为 D-47「10% 原生骨架触感壳 + 90% 纯 Vite 静态内核 + 全自动无感热更 + 去 Next.js + 清退 Studio」提供**唯一接口契约**与**零冲突多线程并行轨道**。所有并行线程必须严格遵守本文件的契约与目录所有权，不得越界改写他人文件。

---

## 一、全端锁死的唯一接口契约（Contract First）

### 1. `pack-manifest.json` 增量热更清单格式
由 `tools/build-app-pack.mjs` 生成，随 `kernel/dist-pack/` 发布至 R2（`v3/app-pack/`）并内置一份进 iOS/Android 安装包：

```json
{
  "schemaVersion": 1,
  "bundleId": "20261127-abc1234",
  "builtAt": "2026-11-27T21:30:00Z",
  "entry": "index.html",
  "files": {
    "index.html": { "size": 1842, "sha256": "..." },
    "assets/app-9a8b7c.js": { "size": 94120, "sha256": "..." },
    "assets/app-3d4e5f.css": { "size": 28410, "sha256": "..." }
  }
}
```

- **本地状态文件 `active.json`**：`{ "bundleId": "...", "installedOnBuiltinId": "...", "activatedAt": "..." }`（重装新版原生壳时，若 `installedOnBuiltinId != currentBuiltinId`，自动淘汰旧沙盒包改用新版内置包）。
- **固定同源 Origin**：
  - iOS (`WKURLSchemeHandler`)：`askbible-pack://app/`
  - Android (`WebViewAssetLoader`)：`https://pack.askbible.local/`
  - 所有本地拦截响应必须带 `Cache-Control: no-store, no-cache`。

### 2. `NativeBridge` 5 组最小双向契约（`window.AskBibleBridge`）
所有原生能力仅通过以下 5 组协议暴露，Web/PWA 环境由 `kernel/src/bridge/web-fallback.ts` 自动降级：

| 域 | 方法 / 本地 HTTP 路由 | 说明 |
| :--- | :--- | :--- |
| **1. 本地经文库 (`bible`)** | `GET /local-db/chapter?t={id}&b={osis}&c={num}`<br>`GET /local-db/search?t={id}&q={kw}&limit=50`<br>`GET /local-db/translations` | 原生直查本地 SQLite（0ms、零 WASM）；Web 降级读 R2 静态 JSON + IndexedDB。 |
| **2. 三路音频 (`audio`)** | `bridge.call("audio.intent", { stream, action, payload, origin })`<br>原生推事件：`window.__askbibleEmit("audio.state", snapshot)` | `stream`: `"music" \| "scripture" \| "verse"`；唯一真相在原生 `PlaybackStore`，原生底栏播放坞与内核共享同一状态快照。 |
| **3. 导航壳联动 (`shell`)** | `bridge.call("shell.setTab", { tab })`<br>`bridge.call("shell.setTheme", { mode })`<br>`bridge.call("shell.haptic", { style: "light" \| "medium" \| "success" })`<br>原生推事件：`window.__askbibleEmit("shell.tabSelected", { tab })` / `shell.backPressed` | 原生持有 5 栏底栏 + 贴底播放坞 + 线性马达震动 + 软键盘高度托底，切 Tab 与边缘手势零延迟。 |
| **4. 离线包与热更 (`pack`)** | `bridge.call("pack.status")`<br>`bridge.call("pack.checkNow")`<br>`bridge.call("pack.downloadTranslation", { id })`<br>原生推事件：`window.__askbibleEmit("pack.readyToSwap", { bundleId })` | 日常静默拉取并通知内核；内核在切后台或闲置 15s 且无弹窗/无输入时调用 `bridge.call("pack.commitSwap")` 并用 `sessionStorage` 原地恢复。 |
| **5. 账号与系统 (`sys`)** | `bridge.call("auth.signIn", { provider: "apple" \| "google" \| "email" })`<br>`bridge.call("auth.getSession")` / `bridge.call("auth.signOut")`<br>`bridge.call("sys.setReminder", { enabled, hour, minute })`<br>`bridge.call("sys.syncWidget", { verse })`<br>`bridge.call("sys.shareImage", { dataUrl, text })` | 登录凭证存 Keychain / EncryptedSharedPrefs；提醒、分享、Widget 走原生系统能力。 |

---

## 二、6 条零冲突多线程并行开发轨道

以下 6 条轨道**目录所有权完全隔离**，可同时开 6 个线程（或使用 `/teamwork` / 多子代理）并行开发，最后统一合流：

| 轨道 | 线程角色 | 独占目录 / 文件范围 | 核心交付物 | 独立验收门禁 |
| :--- | :--- | :--- | :--- | :--- |
| **T1** | **减法清理线（Studio 清退）** | `app/studio/`、`app/api/studio/`、`app/api/ai/`、`studio/`、`middleware.ts`、清理无用脚本引用 | 将 `Studio` 归档移至 `/Users/joshua/Desktop/APP/00/archive/01AskBible-studio-20261127/`，清空主仓 Studio 代码与 404 中间件；保留 `docs/` 原样不动 | `npm run check` 全绿，无残留 `studio` 引用报错 |
| **T2** | **热更构建与契约门禁线** | `tools/build-app-pack.mjs`、`tools/check-contracts.mjs`、`scripts/check-hardcoded-colors.mjs` | 生成文件级 SHA-256 `pack-manifest.json`；编写 `check-contracts.mjs` 静态校验 Web ↔ Swift ↔ Kotlin 5 组桥接契约与零野生色值 | `node tools/build-app-pack.mjs --check && node tools/check-contracts.mjs` |
| **T3** | **iOS 10% 轻壳升级线** | `apps/askbible-ios/` | 升级 `PackStore.swift` 支持 `pack-manifest.json` 单文件增量拉取与原子切换；升级 `NativeMediaBridge.swift` 补齐 `/local-db/*` SQLite 路由、Haptic、键盘托底与 5 组桥接协议；保留原生 5 栏底栏 + 播放坞 + 三路音频 | `xcodebuild` Simulator 编译通过 + Swift 单测全绿 |
| **T4** | **Android 10% 轻壳升级线** | `apps/askbible-android/` | 与 iOS 100% 对称升级 `PackStore.kt`、`NativeMediaBridge.kt`（`WebViewAssetLoader` + `/local-db/*` SQLite 路由 + Haptic + 软键盘托底 + 5 组桥接协议）；保留原生 5 栏底栏 + 播放坞 + 三路音频 | `./gradlew :core:test :app:compileDebugKotlin` 全绿 |
| **T5** | **唯一纯 Vite 静态内核线** | `kernel/`（全新独立目录，不碰现有 `app/`） | 搭建极轻 Vite + React/TS 静态内核：`tokens.css` 单一色彩真源、`PlatformAdapter`（App 桥接 + Web 降级）、`bibleRepo`、`updater/`（空闲 15s 静默切新 + `sessionStorage` 原地恢复）、`sw.js` + `manifest.webmanifest`，首批迁入全景 / 探索 / 人物馆 / 读经计划 / 藏书票 / 设置，随后迁入阅读器与首页 | `cd kernel && npm run build`（产出 `dist-pack/` + `pack-manifest.json`，首屏 JS gzip ≤ 120KB） |
| **T6** | **边缘薄 SEO 与静态托管线** | `workers/askbible-edge/` | 编写 ~150 行 Cloudflare Worker：托管 `kernel/dist-pack/` 静态资源，对**所有请求**统一注入人机一致的 `<title>` / `og:*` / 简短静态摘要（零 UA 区分、防 Cloaking），保留 `/api/app-build` 与 `ASKBIBLE_SYNC` Service Binding | 本地 `wrangler dev` 探活 `/`、`/read/JHN/10`、`/explore` 均返回正确 Meta 与静态内核 |

---

## 三、合流与分步上线顺序（零中断）

1. **第一批合流（T1 + T2 + T3 + T4）**：清退 Studio + 底座升级完毕，双端原生轻壳已具备文件级 SHA-256 增量无感热更与 `/local-db/*` 能力（此时老页面零影响）。
2. **第二批合流（T5 首批业务页）**：全景、探索、人物馆、读经计划、藏书票、设置迁入 `kernel/` 并验证无感热更闭环，删除 iOS/Android 对应重复原生页面。
3. **第三批合流（T5 阅读器/首页真机手感盲测 + T6 切换 Web 主站）**：真机验收经文双语排版、点击/长按高亮、原生 Haptic 震动与首页静音视频不抢音频焦点；验收通过后，全端收口 100% 同一内核，并将 `askbible-web` 平滑切换至 `workers/askbible-edge`（彻底告别 Next.js + `vinext`）。
