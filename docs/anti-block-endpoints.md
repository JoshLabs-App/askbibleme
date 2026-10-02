# 防封换线：域名盘点 + 分步改造方案

**状态**：JOSHUA 2026-10-01 确认（DECISIONS D-20）。三端代码已做完并验证，网页已合 main 上线，**原生两端还没发版**——
见文末「五、实施记录」和「六、怎么操作」。网页已上线；原生两端发版等 Josh 定（OPEN-ITEMS O-18）。
**日期**：2026-10-01
**参考实现**：`~/Desktop/APP/03MyClass`「2026-09-17 · 抗封域名方案」一节（`docs/DECISIONS.md` 约 1220 行起）；
可照抄 `endpoints.js`、`ios/Tingdao/Model/Endpoints.swift`、`android/.../model/Endpoints.kt`、
`public/endpoints.json`、`workers/supabase-proxy/`。

---

## 一、盘点：写死的域名在哪、是什么角色

只数**真的会发请求**的常量，注释不算。搜索范围：`app/ components/ lib/ hooks/ public/ next.config.mjs`、
`apps/askbible-ios`、`apps/askbible-android`、`apps/askbible-mobile`、`data/`，以及线上配置 JSON。

### 1.1 四个角色

| 角色 | 是什么 | 现在的域 | 现成的第二条线 |
|---|---|---|---|
| `media` | R2 桶 `askbible-media`：金句语音、音乐、自然场景音 / 视频、勋章图、每日灵修、KJV / info-edition 整本库、APK、`version.json`、`migrate.json`、6 个配置 JSON | `pub-f30fb48025d841f09c37bb9b52df5354.r2.dev`（绝大多数）<br>`askbible-media.joshlabs.app`（安卓更新检查、下载页） | **已经有两条**，同一个桶，实测同一份对象（`version.json`、`bible/kjv.sqlite`、APK 两边都 206，CORS 都是 `*`）。只差客户端不会换。 |
| `site` | 主站 `askbible.me`：网页本身 + App 调的接口（在线译本目录 / 章节 / 书名、章节音频地址解析、注销账号） | `askbible.me`（单线） | 没有。`www` 只是 301 回根域；`askbible-app.onrender.com` 实测 503。 |
| `api` | Supabase（登录、会员同步），和听到同一个项目 | `tgobadhdylarhssudplc.supabase.co`（单线） | 没有 AskBible 自己的。听到那边有 `my-class-supabase.josh-zeng.workers.dev` 反代的是同一个项目。 |
| 外站 | `media.fhl.net`（和合本朗读）、`www.audiotreasure.com`（KJV 朗读）、`hymncommons.org`（72 首音乐直链）、YouVersion 音频 CDN | 别人的域 | 不归我们管，换不了线，本方案不处理。 |

### 1.2 各端写死了几处

| 端 | `media`（r2.dev） | `media`（joshlabs.app） | `site`（askbible.me 接口） | `api`（supabase.co） | 备注 |
|---|---|---|---|---|---|
| **网页**（Next.js） | 7：`lib/bible/golden-verse-audio.ts:27`、`lib/achievements/medal-catalog.ts:50`、`lib/app-install-urls.ts:11`、`lib/bible/mobile-scripture-r2-downloads.ts:7`、`lib/mobile-config-r2.ts:11`、`next.config.mjs:90,96`（服务端 307，7 条路由） | 2：`app/app/page.tsx:21-22`（`version.json`、APK） | 自己就是主站；`lib/auth/public-auth-origin.ts:2-9` 的登录来源白名单只认 askbible.me 三个主机名 | 环境变量 `NEXT_PUBLIC_SUPABASE_URL`（`lib/supabase/config.ts`） | APK 直链有两套不同域名（r2.dev 在 lib 常量，joshlabs.app 在下载页），应合成一处 |
| **iOS 原生** `apps/askbible-ios` | 7：`Audio/AmbientScenes.swift:15`、`Audio/GoldenVerseAudioSource.swift:7`、`Audio/MusicAudioSource.swift:7`、`Model/InfoEditionDownloader.swift:16`、`Model/MedalCatalog.swift:53`、`Model/NatureScenes.swift:66`、`Model/TranslationCatalog.swift:64` | 0 | 5：`Model/RemoteTranslations.swift:10-11`、`Model/RemoteBookNames.swift:9`、`Audio/ChapterAudioSource.swift:97`、`Model/MemberAuthStore.swift:141` | 1：`Model/MemberAuth.swift:124` | 全是 `static let`，换域前会把旧域固化，改造时要变成计算属性 |
| **安卓原生** `apps/askbible-android` | 8：iOS 那 7 处的对等文件 + `data/SolidJoys.kt:45`（每日灵修） | 2：`update/AppUpdater.kt:28`（`version.json`）、`update/MigrateGate.kt:42`（`migrate.json`） | 5：`RemoteTranslations.kt:17-18`、`RemoteBookNames.kt:17`、`ChapterAudioSource.kt:103`、`MemberAuthStore.kt:175` | 1：`MemberAuth.kt:115` | 更新检查自己就是单线：`joshlabs.app` 一封，站外版用户连更新提示都收不到 |
| **RN 老版** `apps/askbible-mobile`（退役中） | 4：`goldenVerseAudioRemote.ts:15`、`musicAudioRemote.ts:9`、`natureVideoR2Source.ts:11`、`ambientSceneAudioSource.ts:9` | 0 | `src/config/askbibleBaseUrl.ts`（5 个出口都回 `https://askbible.me`）、`googleOAuthBrowser.ts:22,26`、`memberReadingSyncApi.ts:114` | 2：`app.config.js:34`、`memberAuthShared.ts:12` | 不再发新版，只要求老包不坏 |

**不能跟着换线的两处**（印出去就收不回来）：成就分享文案和分享图上的 `askbible.me/app`
（iOS `Read/MedalDetailView.swift:181,295`、安卓 `ui/MedalDetail.kt:290,395`）。这个地址要一直活着。

### 1.3 数据里的域名

和听到不一样，**AskBible 的数据基本已经不带自家域名**（听到当时有 905 条绝对音频地址要改）：

- 仓库 `data/`、两端内置资源：没有自家域名（`medals.json` 那条只是注释）。音乐曲目里的 `hymncommons.org` 是外站直链。
- 线上 `version.json`：`apkUrl`、`downloadUrl` 两个绝对地址，指向 `askbible-media.joshlabs.app`。
- 线上 `migrate.json`：`url` 一个绝对地址（开关目前是关的）。
- 线上 `/api/mobile/bible/translations`：KJV 整本库的下载地址一条，指向 r2.dev。
- 其余 7 个线上配置 JSON：没有自家域名。

### 1.4 盘点时顺带发现的

1. **主站实际在 Vercel，不在 Render**。`askbible.me` 的响应头是 `server: Vercel`；`www.askbible.me` 指向
   `askbible-app.onrender.com`（只做 301 回根域），直接访问 onrender 地址是 503。`docs/HANDOFF.md` 第 47 行
   「生产在 Render + Persistent Disk（不是 Vercel）」已经过时。
2. **`td.askbible.me`、`cd.askbible.me` 还没有 DNS 记录**（03MyClass O-28 等 JOSHUA 在 Porkbun 加 CNAME）。
3. **桶里没有 `healthz.txt`、没有 `endpoints.json`**（探测逻辑「404 也算通」，不构成阻塞）。
4. 网页 `app/globals.css` 第 1-2 行从 `fonts.googleapis.com`、`cdn.jsdelivr.net` 引图标字体——
   这两个第三方域在国内不稳，而且是阻塞渲染的 CSS。
5. **国内到底通不通，本机测不出来**——已用 Globalping 的大陆节点实测，结果见「五、实施记录」。
6. 官网首页会话（分支 `claude/upbeat-mayer-752c72`，D-21）新增 `lib/sibling-app-urls.ts`，写了三个外站入口：
   听到 `https://td.askbible.me/`、查到 `https://chadao-media.joshlabs.app/download.html`、小小圣经的 YouTube 频道。
   都是给人点的链接，不参与换线。

---

## 二、现在被封会怎样（老版本救不了的部分）

AskBible 是本地优先：内置四译本、读经计划、人物馆、每专辑第一首音乐都在包里，断网也能用。
受影响的只是联网那部分：

| 被封的域 | 已发布版本（App Store ≤ 1.1.2、Play / 下载页 ≤ 1.0.47、RN 版）会坏什么 |
|---|---|
| `askbible.me` | 网页全断（连带 td / cd 入口）；App 的在线译本、YouVersion 朗读、注销账号 |
| `pub-…r2.dev` | 金句语音、非首曲音乐、自然场景、勋章图、每日灵修、KJV 下载 |
| `askbible-media.joshlabs.app` | 站外版安卓的更新提示和 APK 下载；网页下载页的版本号 |
| `supabase.co` | 登录、会员同步 |

**已经装在用户手机上的老版本改不了**，只能保证老地址一直不下线。新能力只能随新版到达。

---

## 三、分步方案

### 总体做法（和听到一致）

- 一份真源 `data/endpoints.json`（按角色列候选域 + 探测路径），用生成器出三端内置表
  （项目里 `gen:medals`、`gen-site-copy` 已经是这个路子），同一份传到桶根和 `public/`。
- 三端各一个 Endpoints 入口：内置候选表 → 读本地缓存（启动时同步生效）→ 后台并发探测，
  取**列表里最靠前**那条通的 → 从通的域拉线上 `endpoints.json` 更新候选表 → 再挑一次。
- 「通」= 有 HTTP 响应（404 也算），全挂就保持原样。内置表永远垫在线上表后面兜底。
- 角色：`media`（R2）、`site`（主站接口）、`api`（Supabase，和听到同名同义）。

### 第 0 步 · 基础设施（不动代码、不发版，对现有用户零影响）

| # | 做什么 | 说明 |
|---|---|---|
| 0.1 | 国内可达性实测 | 用在线多节点测速工具测 5 个地址：`askbible.me`、`pub-…r2.dev`、`askbible-media.joshlabs.app`、`supabase.co`、听到那个 workers.dev 反代。结果决定候选域的排序，也决定这件事有多急。内置浏览器读文字结果，约十来次往返，不看图。 |
| 0.2 | 桶里放 `healthz.txt` + `endpoints.json` | 纯新增对象，两个域同时可取 |
| 0.3 | 部署 Supabase 反代 Worker | 照抄听到 `workers/supabase-proxy/`（69 行），改个名字单独部署。本机 wrangler 是登录态，直接 `wrangler deploy` |
| 0.4 | 部署主站接口反代 Worker | 同样的十几行，上游换成 `askbible.me`，只放行 `/api/mobile/*` 和 `/api/read/chapter-audio`。走 Cloudflare 的 IP，和 Vercel 不在一条线上 |
| 0.5 | 给两个 Worker 绑备线域名 | 用哪一族域名见「待 JOSHUA 决定」第 1 条 |

### 第 1 步 · 网页（Vercel 部署即生效，不过商店）

| # | 做什么 |
|---|---|
| 1.1 | 新增网页版 Endpoints 模块（照听到 `endpoints.js`，localStorage 缓存） |
| 1.2 | 网页直连 R2 的 5 处常量改走 `media` 角色；`app/app/page.tsx` 的两条 joshlabs.app 地址并进同一处，APK 直链从此只有一个来源 |
| 1.3 | 图标字体改成自托管，去掉 `fonts.googleapis.com` 和 `cdn.jsdelivr.net` 两个外部依赖 |
| 1.4 | `next.config.mjs` 那 7 条服务端 307 暂时不动（服务端替用户探测不了线路）；0.1 的结果出来后如果 r2.dev 在国内确实不通，再把目标换成自定义域——改完部署就生效，老 RN 包跟着 307 走 |
| 1.5 | 网页备用入口（要不要做见「待 JOSHUA 决定」第 2 条）：Vercel 项目加一个域名，`public-auth-origin.ts` 白名单、Supabase 回跳白名单各加一条 |

注意：`public/sw.js` 官网首页会话改过（分支 `claude/upbeat-mayer-752c72`，还没合 main），网页这一步要以它为底。

### 第 2 步 · 原生新版（要发版）

| # | 做什么 |
|---|---|
| 2.1 | iOS 新增 `Model/Endpoints.swift`，替换 13 处常量（7 + 5 + 1），`static let` 改计算属性 |
| 2.2 | 安卓新增 `core/.../data/Endpoints.kt`，替换 16 处常量（8 + 2 + 5 + 1），`const val` 改 `get()` |
| 2.3 | `media` 换线后已下载的缓存不受影响（缓存键用对象路径，不用完整地址——实现时逐个核对） |
| 2.4 | ~~`version.json` 加相对字段 `apkPath`~~ 实施时改成：数据格式不动，新版安卓把 `apkUrl` 里的域换到当前线路（见第五节）；更新检查地址本身也走候选域 |
| 2.5 | 换线验证方法照听到：把一个假域塞到候选表最前面，看日志是否跳过它选中真域 |

**发布顺序**：

1. 安卓**站外版**先发（`deploy_android.py`，不过审，当天到）→ 三星真机验证换线；
2. 验证通过后 Play 和 App Store 一起提审；
3. RN 老版不动。

### 第 3 步 · 线上数据切换（分阶段发布的约束落在哪）

**这套方案里没有「先发版、等用户更新、再换线上数据」的破坏性一步。** 原因：数据里本来就几乎没有自家域名，
要加的字段全是加法（`apkPath`、`endpoints.json`），老版本读不到新字段也照常工作。

分阶段只体现为一条**永久约束**——下面这些地址老版本一直在用，永不下线、永不改格式：

- `pub-f30fb48025d841f09c37bb9b52df5354.r2.dev` 的公开访问（基础设施铁律 1）；
- `askbible.me` 的 `/api/mobile/*`、`/api/read/chapter-audio`、`/app`，以及 `next.config.mjs` 的 7 条 307；
- `version.json` 的 `apkUrl` / `downloadUrl`、`migrate.json` 的 `url` 两个老字段。

唯一可随时调的线上数据：`version.json` 里老字段指向哪个域（老站外版只认它）。哪条线被封，就把它改指向还通的那条，不用发版。

### 这套方案管不到的（固有边界）

- **网页没法自动换线**：用户手输的是域名，`askbible.me` 被封，网页用户只能靠事先知道备用入口。两个入口的登录状态不互通。
- **Google 登录绕不过 `supabase.co`**：两端 Google 走网页授权流程，回跳地址是 Supabase 自己的域。
  Apple 登录、邮箱登录走反代没问题。（国内本来也用不了 Google 登录，实际影响小。）
- **备线和主线都在 Cloudflare / Vercel 上**：封的是整个平台而不是具体域名时，这套救不了。
- 外站音频源（fhl、audiotreasure、hymncommons、YouVersion）不归我们管。

---

## 四、和别的会话的边界（2026-10-01）

- 「做 AskBible 官网首页」会话：改动全在分支 `claude/upbeat-mayer-752c72`（worktree `strange-dewdney-3855d7`），
  领先 main 20 个提交、没合。它**没碰**任何域名常量、`lib/app-install-urls.ts`、`apps/askbible-mobile`；
  它改了 `app/app/page.tsx` 的文案和 `public/sw.js`。本方案动这两个文件时以它的分支为底。
- 文档编号它已占到 D-19、O-15；本方案用 O-16。

---

## 五、实施记录（2026-10-01）

### 国内可达性实测

Globalping 的中国大陆节点（每个地址 24 个，移动 / 联通 / 电信 / 阿里云 / 腾讯云都有），HTTPS HEAD：

| 地址 | 通 | 说明 |
|---|---|---|
| `askbible.me` | 22/24 | 2 个移动节点 TCP 超时 |
| `pub-f30f…r2.dev` | 24/24 | |
| `askbible-media.joshlabs.app` | 24/24 | |
| `tgobadhdylarhssudplc.supabase.co` | 19/24 | 5 个移动节点连接被重置——**Supabase 现在就已经有人连不上** |
| `my-class-supabase.josh-zeng.workers.dev`（听到的备线） | **0/24** | `*.workers.dev` 国内整段不通，这条备线是废的 |
| `askbible-sb.joshlabs.app`（新，Supabase 反代） | 24/24 | |
| `askbible-site.joshlabs.app`（新，主站接口反代） | 24/24 | |
| `cdn.jsdelivr.net`（网页原来的图标字体） | 13/24 | 10 个节点被拒绝连接 |
| `fonts.googleapis.com`（网页原来的图标字体） | 22/24 | |

结论：反代**必须绑自定义域**，workers.dev 地址不能进候选表（`tools/endpoints-sync.mjs` 会拦）；
Supabase 反代不是备而不用，移动网络上现在就用得着；jsdelivr 那条阻塞渲染的图标字体引用必须拿掉。

### 已上线的基础设施（纯新增，不影响任何现有用户）

- Worker `askbible-supabase` → `https://askbible-sb.joshlabs.app/`（`workers/supabase-proxy/`）。
  实测 `/healthz.txt` 200、OPTIONS 预检 204、`/auth/v1/authorize?provider=google` 原样 302 到 Google、不带 key 照样 401。
- Worker `askbible-site-proxy` → `https://askbible-site.joshlabs.app/`（`workers/site-proxy/`）。
  只放行 `/api/mobile/` 和 `/api/read/`，其余 404。实测在线译本目录和直连 md5 一致，注销接口不带 token 照样 401，
  配置接口的 307 原样交还。
- 桶根新增 `endpoints.json`、`healthz.txt`，两条 media 线路都取得到。

### 候选域表（真源 `data/endpoints.json`）

| 角色 | 第一条（老版本写死的那个） | 第二条 |
|---|---|---|
| `media` | `pub-f30f…r2.dev` | `askbible-media.joshlabs.app` |
| `site` | `askbible.me` | `askbible-site.joshlabs.app` |
| `api` | `tgobadhdylarhssudplc.supabase.co` | `askbible-sb.joshlabs.app` |

每个角色第一条都是老版本写死的地址，所以**没探测之前新版的行为和老版一模一样**，现有的对拍也不用改期望值。
`media` 两条实测都是 24/24；按基础设施铁律 4 自定义域更适合当主线，想换顺序改真源即可（内置表要同步改，随下个版本）。

### 代码

| 端 | 入口 | 改了什么 |
|---|---|---|
| iOS | `Model/Endpoints.swift` | 13 处常量改成取当前线路（`static let` → 计算属性）；启动和回前台时探测（10 分钟限一次） |
| 安卓 | `core/.../data/Endpoints.kt`（纯 JVM）+ `app/.../data/EndpointsStore.kt`（SharedPreferences） | 16 处常量；`MainActivity.onCreate` 同步读缓存，`onStart` 后台探测；更新检查和 `migrate.json` 也走候选域，`apkUrl` 换到当前线路 |
| 网页 | `lib/endpoints/` + `components/shell/EndpointsBoot.tsx` | 金句语音、勋章图、APK 直链走 `media` 角色；下载页不再单独写死 joshlabs.app；图标字体自托管（npm 包 `material-icons`、`@mdi/font`） |
| 工具 | `tools/endpoints-sync.mjs`、`tools/endpoints-live-check.mjs` | 见「六、怎么操作」 |

`version.json` 的数据格式没动：新版安卓把 `apkUrl` 里的域换成当前线路再下载，老版照旧读原字段。
方案里说的 `apkPath` 新字段不需要了（`deploy_android.py` 是所有项目共用的，能不动就不动）。

没做的：RN 老版（按 D-20 不动）；`next.config.mjs` 的 7 条 307（r2.dev 实测通，不用换）。网页端 Supabase 换线和网页备用入口在第二轮做了，见下。

### 验证

- 对拍：`check:endpoints`、`check:ambient-scene`、`check:chapter-audio`、`check:member-auth`、`check:music-audio`、
  `check:golden-verse`、`check:medals`、`check:translation-catalog`、`check:info-edition` 通过。
  `check:nature-scenes`（缺场景视频素材）和 `check:member-sync`（最近搜索上限两边不一致）在主目录本来就失败，和这次无关（O-21）。
- 联网自检 `check:endpoints:live`：两端都从「缓存线路和候选表第一条都连不上」恢复到真源里的线路，结果一致。
- 网页：`tsc --noEmit` 通过；`lib/endpoints/endpoints.test.ts` 6 条（含「第一条被墙换第二条」「全挂保持原样」「线上表写坏内置表兜底」）通过；
  本地预览 `/app`：探测结果写进 localStorage、下载链接换到当前线路、图标字体从本站加载、没有 jsdelivr / googleapis 请求。
- iOS：专用模拟器里预置「三条线路都指向连不上的域」→ 启动 App → 读回偏好设置，三个角色都换回了通的线路、候选表换成线上那份。
- 安卓：模拟器装侧载 Release 包，同样的预置 → 同样的结果，无崩溃。
- 真机：三星装了 `me.askbible.native` 1.0.47 (244)，home iPhone 装了 `me.askbible` 1.1.2 (133)，都是覆盖安装、没清数据。

### 踩过的坑

- **worktree 里缺一批被 git 忽略的文件**，对拍和打包都跑不了：`apps/askbible-mobile/assets/content/*`、
  两端的 `nature/` 和 `verse-timings.sqlite`、安卓空目录 `assets/music/`、`apps/askbible-android/local.properties`、
  `apps/askbible-mobile/android/keystore.properties` 和 `app/upload.keystore`、根目录 `.env.local`。
  从主目录软链或 `cp -Rc` 进来即可（都在忽略名单里，不会被提交）。`apps/askbible-mobile` 的 vitest 在 worktree 里也跑不了（没有它自己的 node_modules）。
- zsh 里 `read host path` 会把 `PATH` 冲掉（`path` 是 zsh 的特殊变量），循环变量别叫 `path`。
- 对拍脚本是把单个 Swift 文件拿出来用 swiftc 编的，音源文件引用了 `Endpoints` 之后，编译清单里要加上 `Model/Endpoints.swift`。
- 模拟器上那个 `me.askbible.native` 是 Release 签名的侧载包，Debug 包盖不上去也 `run-as` 不了；
  要预置偏好设置用 `adb root` 直接写 `/data/data/…/shared_prefs/`（写完 `chown` + `restorecon`）。

### 第二轮（2026-10-01，Josh「2 好了，其它你帮我处理」）

- **网页备用入口 `https://askbible.joshlabs.app`**：Vercel 项目 `askbibleme`（团队 `joshlabsapp`）加了这个域名；
  Cloudflare 加 CNAME `askbible` → `34c4f7c76d6872fe.vercel-dns-017.com`（仅 DNS，不开代理）；
  Supabase 回跳白名单加 `https://askbible.joshlabs.app/**`；`lib/auth/public-auth-origin.ts` 的 `BACKUP_ENTRY_HOSTNAMES`
  放行它的登录回跳，`middleware.ts` 给它加 `X-Robots-Tag: noindex`（和主站内容一样，别被收成重复站）。
  两个入口的登录状态不互通（cookie 按域名存）。
- **网页端 Supabase 换线**：`lib/supabase/browser.ts` 的入口走 `api` 角色；会话 cookie 名钉死成按官方域名推出来的
  `sb-tgobadhdylarhssudplc-auth-token`（服务端 `createServerClient` 也是这么推的），换入口不掉登录。
  每个入口一个客户端实例（`isSingleton: false` + 自己缓存）。
  验证：反代上跨域预检 204、错误密码返回 `invalid_credentials`（和直连一致）、匿名读 `askbible_profiles` 200；
  本地预览登录页错误密码显示「邮箱或密码错误」，点 Google 跳到账号选择页，PKCE cookie 名是钉死的那个。
- **Vercel 没有命令行登录态**：加域名是在 Josh 登录好的 Chrome 里调 Vercel 自己的接口做的
  （`POST /api/v10/projects/askbibleme/domains?slug=joshlabsapp`），页面上的「Add Existing」按钮在后台标签页里点不动。
  Supabase 后台同理：输入框用 `form_input` 填，保存按钮用页内 `click()`。

## 六、怎么操作

```bash
npm run gen:endpoints         # 改了 data/endpoints.json 之后：生成 public/endpoints.json 并核对两端内置表
npm run check:endpoints       # 只核对（不一致退出 1）
npm run endpoints:push        # 把 endpoints.json + healthz.txt 传到桶根（原生两端从这里拉）
npm run check:endpoints:live  # 联网自检：两端从连不上的缓存线路恢复
cd workers/supabase-proxy && npx wrangler deploy   # 改了反代之后
cd workers/site-proxy && npx wrangler deploy
```

**加一条新线路**：改 `data/endpoints.json` → `Endpoints.swift` / `Endpoints.kt` 的内置表同步改 → `npm run gen:endpoints` →
`npm run endpoints:push`（原生新版立刻生效）→ 网页要重新部署才带上新的 `/endpoints.json`。内置表随下个版本。

**某条线路被封了**：不用做任何事，新版客户端下次启动 / 回前台自己换。只有两件事要手动：
老站外版安卓只认 `version.json` 的 `apkUrl`，把它改指向还通的那条；网页用户要改用备用入口 `https://askbible.joshlabs.app`（要事先让他们知道这个地址）。

**候选域的规矩**：`https://主机名/`，单层子域，不用 `*.workers.dev`。
