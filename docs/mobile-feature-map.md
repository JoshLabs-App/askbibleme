# Mobile Feature Map（进屏路径）

给 Agent / 验收用：**截图或模糊描述 → 定位功能 → 走真路径复现**。  
真源导航：`apps/askbible-mobile/app/`；探索瓦片：`src/explore/exploreEntries.ts`。

配套验收 Skill（改对应域时遵循）：

- `.cursor/skills/验收-UI/SKILL.md`
- `.cursor/skills/验收-OAuth/SKILL.md`
- `.cursor/skills/验收-媒体/SKILL.md`

真机冒烟 / 有门禁合入：`docs/mobile-maestro-auto-merge.md`  
（`npm run mobile:maestro:smoke` · PR 标签 `auto-merge`）

壳层：**底栏四 Tab** = Home · Music · Read · Explore；**中间 FAB** = 计划听读（非 Tab）；**左上汉堡** = 抽屉（无独立 Settings Tab）。

---

## 壳层入口

| 功能 | 进入方式 |
|------|----------|
| Home | 底栏 Home |
| Music | 底栏 Music |
| Read | 底栏 Read |
| Explore | 底栏 Explore |
| 计划听读 | 底栏中间语音 FAB → `/read/plan-play` |
| 用户菜单 | 任意 Tab → 左上汉堡 → 抽屉 |
| Welcome | 冷启动未完成；或 Explore → Welcome 瓦片 → `/welcome` |
| Login / Register | 抽屉 → Log in / Register；或 Explore 问候（未登录）；或 Welcome 登录区 → `/login` `/register` |
| Feedback | 抽屉 → Send feedback → `/feedback`（mailto 失败时） |

底栏在：Home 横屏/沉浸、Music 播放自动隐、阅读计划向导中会隐藏。

---

## Home（`/` · 自然场景 + 金句）

| 功能 | 进入方式 |
|------|----------|
| 场景 / 环境音 | 右上齿轮 → Scenes and sounds |
| Live 视频 ↔ 模糊海报 | 齿轮打开 → 左侧 Blur 拇指开关 |
| 金句文字 | 首页主文案（全量池） |
| 金句语音 | 底条音量 |
| 打开经文 | 点金句正文 → `/read/[bookId]/[chapter]?verse=` |
| 首页专辑条 | 底条：安静 / 下午茶 / 赞美诗 / 钢琴（**默认只从安静选曲**，用户未主动切专辑前） |
| 字号 / 睡眠定时 | 齿轮打开 → 对应行 |
| 沉浸 | 闲置或横屏：chrome + 底栏自动隐；点一下恢复 |

---

## Music（`/music`）

| 功能 | 进入方式 |
|------|----------|
| 专辑 | 专辑条：安静、下午茶、赞美诗、钢琴、睡眠、专注工作 |
| 播放 / 进度 / 队列 / 睡眠 | 页内控件 |
| 非首曲 | R2 直链 + 本机缓存（勿走 askbible.me） |

---

## Read（`/read`）

| 功能 | 进入方式 |
|------|----------|
| 目录 / 书卷 | Read Tab → `/read`；章页再点 Read → 目录 |
| 独立目录 | 章页 → catalog；`/read/catalog` |
| 章 | 选书卷章；Home 金句；计划；闹钟；Widget → `/read/[bookId]/[chapter]` |
| 搜索 | 目录或章 chrome → Search → `/read/search` |
| 收藏 | 目录或章 → Favorites → `/read/favorites` |
| 计划列表 | 今日计划面板等 → `/read/plans` |
| 计划详情 | 计划卡片 → `/read/plans/[planId]` |
| 圣经设置面板 | Read 栈右上齿轮（字体 / 译本 / 朗读）；非主走 `/read/translations` 路由 |

---

## Explore（`/explore`）

| 瓦片 | 路径 |
|------|------|
| Welcome | `/welcome` |
| Reading alarm | `/explore/reading-alarm` |
| Reading plan | `/explore/reading-planner`（多步向导；完成后常去 `/read`） |
| Year / day count | `/explore/year-day-count`（生日设置可走同页 modal 或 `/…/birth-settings`） |
| Narrow gate | `/explore/narrow-gate` |
| Praise & worship | `/explore/praise-worship` |
| Prayer | `/explore/prayer` |
| Figures | `/explore/figures` → `/explore/figures/[slug]` |
| Historical creeds | `/explore/historical-creeds` |
| 精选文章 | `/explore/articles/[slug]`（reading-planner slug 不进网格） |

另：Explore 标题可进登录或改名；习惯统计在首页内联。  
**分阶段瓦片**仅当远端 `visibleStagedEntryIds` 打开时出现（feasts、maps、timeline、scripture-pool 等）。

---

## 抽屉（汉堡）

| 项 | 作用 |
|----|------|
| Locale | 界面语言 |
| Bible version + 金句语音语言 | 中/英等 |
| Log in / Register 或 已登录 / Log out / Delete account | 账号 |
| Send feedback | 反馈 |
| Reading sync | 仅已登录 |
| App version | 页脚（Android 水印另有规则） |

---

## 关键子流（验收必记）

### Login / OAuth
1. 抽屉 / Explore 问候 / Welcome → Login 或 Register  
2. Google：优先原生；否则浏览器 OAuth（Android 常见浏览器）  
3. Apple：**仅 iOS**  
4. 成功 → session，清 welcome gate，回 `/`  
5. **从 App 发起的登录必须回调回 App**；勿擅自改成仅网页 HTTPS 回调  

### Reading alarm
Explore → Reading alarm（或 Welcome 闹钟区）→ 设时/开关/播放模式 → 触发后 overlay，并常导航到 `/read` 或计划经文流。

### 金句
仅 Home：文字全量池；语音 TEMPORARY 走 Cloudflare R2（见 `docs/mobile-golden-verse-audio.md`）。抽屉可切金句语音译本。

### Immersive
Home 闲置/横屏隐 chrome；Live 用场景条 Blur，不是独立路由。

---

## 导航真源文件

| 角色 | 路径 |
|------|------|
| Root stack | `apps/askbible-mobile/app/_layout.tsx` |
| Tabs | `app/(tabs)/_layout.tsx` · `src/shell/ShellTabBar.tsx` |
| 抽屉 | `src/shell/ShellNavDrawer.tsx` |
| 中间 FAB | `src/shell/ShellScripturePlayFab.tsx` |
| Explore 瓦片 | `src/explore/exploreEntries.ts` |
| Read 栈 | `app/(tabs)/read/_layout.tsx` |
| Welcome 路由 | `src/onboarding/welcome-routes.ts` |

---

## 非主入口 / 勿当产品路径

- `/scenes`、`/relax`：路由在，主 UI 几乎进不去  
- `journey` Tab：隐藏，重定向 Home  
- `app/dev/*`：e2e / smoke，非产品 IA（含 `dev/maestro-smoke-prep` → Maestro 冒烟前置）  
- `/read/translations`：设置面板才是主 UI  

平台：验收与对齐默认 **iOS 优先**，再 Android。
