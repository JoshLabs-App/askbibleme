# 后台与工程侧开发说明（节选）

面向在仓库内维护 **管理后台**、**多语言** 与后续 **App 壳** 的约定。产品哲学类文档见 `docs/01-vision.md` 等；本文只谈实现与边界。

---

## 多语言（i18n）

### 现状

- **语言枚举**：`lib/i18n/config.ts` 中 `SUPPORTED_LOCALES`（当前 `zh-CN`、`en`），与 `locales/*.json` 一一对应。
- **文案加载**：`lib/i18n/messages.ts` 将 JSON 汇入 `MESSAGES`，`translate()` 按路径取字符串。
- **持久化**：`localStorage` 键 `selah-locale-v1`（`LOCALE_STORAGE_KEY`）存用户当前语言；**同名 Cookie** `selah_locale`（`LOCALE_COOKIE_NAME`）与之一致写入，供 **SSR 首屏** 与客户端快照对齐，减轻水合错位。
- **首访（无本地存储）**  
  1. **服务端**（`app/layout.tsx`）：若有 Cookie 则 `parseLocale`；否则用请求头 **`Accept-Language`** 推断（`inferAppLocaleFromAcceptLanguage`），映射规则：`en*` → `en`，`zh*` → `zh-CN`，其余 → 默认 `zh-CN`。  
  2. **客户端首帧**：`useSyncExternalStore` 在无 `localStorage` 时使用与 SSR 相同的 `initialLocaleGuess`，保证水合一致。  
  3. **`useLayoutEffect`（首帧内）**：若无 `localStorage`，再按 **`navigator.languages` / `navigator.language`** 写入并持久化（`inferAppLocaleFromNavigator`），与**设备/浏览器界面语言**对齐；若与 `Accept-Language` 不一致，会在首帧内切到设备语言（通常无感）。  
  4. 若已有 `localStorage`（用户曾选手动切换），则**以存储为准**，并**回写 Cookie**，便于下次整页加载时 SSR 正确。
- **手动切换**：语言弹窗仍调用 `setLocale`，同时更新 `localStorage` + Cookie + `document.documentElement.lang`。
- **后台侧入口**：`AdminShell` 左栏底部「语言」与前台共用上述存储与 Cookie。
- **前台壳入口**：`AppShellTopBar` 左栏菜单「语言」打开 `LocalePickerModal`；弹层须挂在不会因菜单关闭而卸载的节点上。

### 与「仅默认中文」策略的关系

- 未再强制「无存储时一律中文」：**无存储时**由 **Accept-Language（SSR）** 与 **navigator（客户端落盘）** 决定，**繁体等 `zh-*` 一律映射到 `zh-CN` 文案**（未单独做 `zh-TW` 资源前保持此规则）。

### 内容数据（非 JSON 文案）

- 音乐伴侣等 **JSON 配置**里的展示字段可为 **双语对象**（如 `{ "zh-CN": "…", "en": "…" }`），解析见 `lib/music-companion/store-file.ts`、`lib/i18n/localized-text.ts`（`resolveLocalized`）。后台保存时应 **保证 `zh-CN` 必填**；`en` 可选，缺省时前台可回退中文。
- **自然 · 影片**：每条可有 `previewFrameSrc`（`/nature/preview-posters/*.jpg`），上传视频时由服务端 **ffmpeg** 从 **4K 母片**（`*.master.*`）截第 1 帧生成（最长边 ≤3840、JPEG `-q:v 2`）；首页静图优先用该图。旧数据从 720 帧升级：本机 `npm run nature:regenerate-preview-4k`（`--force`，需 ffmpeg）。仅补缺无预览帧的条目：`npm run nature:backfill-preview-frames`。无 ffmpeg 的环境（如部分 Serverless）上传仍成功，但响应里会有 `previewFrameWarning`，预览条回退为 `thumbSrc` 或内联视频。

### 场景命名与「语言切换」（产品 + 实现）

- **「自动切换」指什么**：指界面语言为英文时，展示字段尽量用 **内容里已写好的英文**；**不是**调用翻译 API 实时机翻。机翻不适合经文/敬拜语境，且成本高、难控品质。
- **音乐陪伴 · 场景（`Scene`）**：`Scene.title` 在类型上已是 `LocalizedField`，`music-companion.json` 解析已支持 `parseOptionalLocalized`（与曲目 `title` 同源）。**只要在后台为场景补上 `en`（可选），且前台任意展示场景名的地方使用 `resolveLocalized(scene.title, locale)`**，就会随语言切换。若某屏暂不展示场景标题，则无需改 UI，直到产品要露出名称。
- **自然 · 影片卡片标题**：`NatureVideoEntry.title` 当前为 **纯字符串**，仅一种语言；若要随 `AppLocale` 切换，需：类型与 `nature-settings.json` 升级为 `LocalizedField`、读盘校验、后台编辑支持中英、前台 `NatureSceneLayer` 等用 `resolveLocalized`。**未改 schema 前**，英文界面下场景名仍会显示 JSON 里那条字符串（通常为中文）。
- **落地检查清单**：新增或展示「场景 / 素材名」时，问两句：(1) 字段是否为 `LocalizedField`？(2) UI 是否 `resolveLocalized(..., locale)` 而非写死 `primaryLocaleText` 或裸字符串？

### 新增一种语言时要改哪里

1. `SUPPORTED_LOCALES` + `parseLocale`  
2. 新增 `locales/<locale>.json` 并在 `MESSAGES` 注册  
3. 检查所有 `Record<AppLocale, …>`（如 `HOME_VERSES_BY_LOCALE`）是否补全  
4. manifest / `theme-color` 等是否与该语言市场有关（按需）

---

## App 化（PWA → 原生壳）时的对齐点

多语言方案按 **「单页 + 本地持久化 + Cookie 辅助 SSR」** 设计，与 **Expo / Capacitor 包 WebView** 兼容：

- **沿用同一存储键** `selah-locale-v1`：在原生里映射到 `AsyncStorage` / `NSUserDefaults`；**启动时**将值同步到 **Cookie**（或与 Web 相同域名下由壳注入），以便若将来存在 **SSR 或内嵌需要首屏语言** 的场景，可与当前 Next 布局一致。
- **设备语言**：Web 端用 `navigator`；原生壳宜在首次启动时读 **`Locale.getDefault()`（Android）** / **首选语言列表（iOS）**，映射到 `en` / `zh-CN` 后写入与 Web 相同的存储键（及按需同步 Cookie）。
- **不强制 URL 分段**：当前无 `next-intl` 式路由前缀，Deep Link 更简单；若未来要做商店页地区 SEO，再拆「营销站多语言」与「App 内语言」两条线。
- **后台与前台**：管理员与用户使用同一浏览器存储域时，语言可能共用；App 内若后台与前台分 WebView 或分域名，则天然隔离——无需额外代码，但要在测试清单里写明。

---

## 后台（Admin）相关路径

- 路由：`app/(admin)/admin/*`，布局 `AdminShell`（`components/admin/AdminShell.tsx`）。
- **邮箱登录（Supabase）**：`/admin/login` 用 Supabase 邮箱+密码；账号需 `is_admin=1` 的 profile，或匹配 `lib/selah-super-admin.ts` 里的固定超级管理员邮箱。登录后签发 `selah_admin_askbible` cookie。
- **工作室口令兜底**：不输入邮箱、只输入密码（`ADMIN_PASSWORD`，见 `.env.example`）即可进入 `/admin`，与 Supabase 是否配置无关。
- **本地免登录**：`npm run dev` 下 `/admin` **默认不要求**邮箱或口令（与 Studio 磁盘默认可写一致）。若要本地仍测登录页，在 `.env.local` 设 `ADMIN_REQUIRE_LOGIN=1` 并重启 dev。
- **从 AskBible 2 导出管理员邮箱**（仅用于审计/对照）：本机有老仓库时运行 `npm run migrate:askbible-admin-emails`。
- 与前台共用：`LocaleProvider` 包在根 `app/layout.tsx`，故后台与前台共享 `t()` 与语言存储（同站点同设备）。

---

## 刻意不做的（防蔓延）

- 不在此文档未讨论的前提下引入 **整站重型的 i18n 路由框架**，除非有明确的 SEO / 分地区部署需求。
- 不把 **用户账号级语言偏好** 与当前 **设备级 localStorage** 混为一谈；若要做「登录后备份语言到资料表」，单独立项，再改 `LocaleProvider` 初始化顺序。
