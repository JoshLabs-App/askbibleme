# AGENTS.md — AskBible.me

## AI 交接入口

其它 AI / Agent 接手前先读：**`docs/AI_HANDOFF.md`**（启动顺序、硬禁令、仓库地图、命令、当前状态）。根目录 `HANDOFF.md` 仅作指针。

## 对外名称（用户可见）

- 产品 / 站点 / App 显示名：**AskBible.me**（域名 `askbible.me`）。真源：`lib/askbible-product-name.ts`。
- 仓库目录、`selah-*` 存储键、原生包名 `me.askbible`（域名 `askbible.me`）等为内部工程名，**不要**出现在用户界面。

## 产品边界（必读）

- AskBible.me **不是** Bible Tool。
- **不是** AI Bible Chatbot。
- **不是** 游戏化圣经。
- **不是** 资料库 / 百科（**人物馆**例外：见 `data/figures/`——经文分类索引 + 简短说明，不是十五段人物百科）。

**核心方向**：一个让人**重新进入圣经的安静入口**。

## 当前开发重点

- 优先：**AskBible.me Studio**（**产品大脑**：文档 + 本地 AI + 写回 `docs/`；见上文「Studio 定位」）。
- **不要**先做：用户端圣经 App、Journey 内容系统、CMS。

## Studio 定位（核心定义）

**AskBible.me Studio 不是「后台」**，也不是 CMS、Notion 替代品、AI Chat 或单纯内容编辑器。

它是 **AskBible.me 的「产品大脑」**（产品哲学操作系统）：目标不是管理页面或用户，而是 **持续校准产品方向**——防止慢慢变成「又一个 Bible App」、防止 **产品失忆**。身份上更接近 **Curator（策展人）** 与 **编辑部**：守护核心体验与产品语言，而不是企业运营后台。

- **最大风险**：不是开发做不出来，而是 **失去核心**（功能堆叠、工具化、认知负荷上升）。因此 **`docs/09-dangerous-directions.md` 与原则类文档极其重要**。
- **贴入摘录 / 草稿后，AI 应做的事**（与右侧动作对应）：**理清意图**（先概括你在忙什么，并建议 2～4 个可执行的下一步方向，对应其它动作）、**提炼**、**归类**、**检矛盾**、**防功能蔓延**、**压缩删减**、**原则与用语**（边界见同段下文）。
- **边界**：AI **不**应代替创始人思考、**不**应自动生成整站产品、**不**应默认扩功能；应帮助 **澄清、警告、删减、对齐语言**。
- **未来设想**（仅记录、不擅自实现）：三种 AI 人格分工——**Philosopher**（原则与跑偏）、**Editor**（压缩与去 AI 味）、**Experience Critic**（安静感与认知负荷）——见 `docs/10-parking-lot.md`。

## 气质与结构（界面层）

- 参考 **Codex** 的协作结构（左上下文 / 中工作区 / 右 AI），但**不要**做成开发者工具。
- 气质：**Codex 的结构 + Notion 的易用 + Calm 的安静感**。
- 面向创始人与产品思考，低认知负荷。

## 工作方式

- **JoshLabs Dev（强制，全项目通用）**：所有开发任务先遵循 `joshlabs-dev` skill（真源：`/Users/joshua/Desktop/APP/skills/joshlabs-dev/SKILL.md`）——先思考再执行、最小可用闭环、优先复用、不擅自扩功能、交付前自检；UI 约束仅在做界面时生效；用户说 `DD` 时继续。AskBible 覆盖层见 `.cursor/rules/joshlabs-dev.mdc`。
- **OAuth 回调先确认终点**：从 App 发起的登录默认必须回到 App；网页 HTTPS 回调只能在明确要求网页完成登录时启用。修改 OAuth 前先确认登录承载端、回调终点与参考实现，不得仅因网页回调可用就替换 App 回调。
- 所有开发保持**低认知负荷**。
- **先思考与质疑，禁止盲目执行**：动手前先判断指令是否合理、是否越界、是否可用更小方案。若冲突、膨胀、重复造轮、或不可逆，先简短质疑并给更紧选项；不要为了听话而做错事。
- **默认先查再做**：能从仓库、配置、文档里找到答案的，先自己查；清晰且在边界内的小任务直接做。
- **少打断，但不闭嘴**：只在合理性、范围、风险、或缺少关键信息时提问；不要对每条明确小指令开辩论。
- **少汇报过程**：只在「开始 / 遇到阻塞 / 完成」三个节点说明进度。
- **先结果，后解释**：确认方向后，先把可交付结果做出来，再补必要说明。
- **不允许**擅自扩展功能；超出范围的想法写入 `docs/10-parking-lot.md`，**不要**在代码里实现。
- 平台实现与优化顺序固定为：**苹果（iOS）第一优先，安卓第二，网页第三**。
- 安卓与网页在交互、视觉与体验节奏上，默认**对齐苹果版本**；若受平台能力限制，先记录差异与原因，再给降级方案。
- 涉及后台/管理端开发流程时，按同一顺序推进：先在苹果标准上完成与验证，再同步安卓，最后同步网页。
- 移动端媒体（音乐/视频/金句音频）默认**本地播放优先**：播放只走安装包内或设备已下载的商店资源包，不作为常规直连远端播放源。
- **大体积增量不走 Render**：禁止用 `askbible.me` / Render 当 App 媒体增量下发通道。详见 `.cursor/rules/mobile-local-media-playback-first.mdc`。
- **金句**：首页文字默认全量池；语音 **TEMPORARY** 走 Cloudflare R2 HTTPS 直链点播（不进安装包、不走 Render）。见 `docs/mobile-golden-verse-audio.md`。恢复本地 zip：`EXPO_PUBLIC_GOLDEN_VERSE_AUDIO_STREAM=0` + `MOBILE_BUNDLE_GOLDEN_VERSE_AUDIO=1`。
- **音乐默认播放**：首页 / 壳层默认只播「安静」专辑；「下午茶 / 专注工作 / 睡眠」等其它专辑不得混入默认选曲池，仅在音乐栏用户主动切换后才播放。
- **音乐安装包（现行）**：
  - **iOS / Android**：默认每专辑只打 **第一首**；其余 **TEMPORARY：Cloudflare R2** 直链 + 本机缓存。见 `musicAudioRemote.ts`。
  - **Android 商店**：生产构建 **默认 `MOBILE_ANDROID_MUSIC_PAD=0`**。**禁止**为上架误开 `MOBILE_ANDROID_MUSIC_PAD=1`（会把全量曲打进 AAB，约 650MB）。遗留 PAD 见 `docs/mobile-android-music-pad.md`，需 `ALLOW_ANDROID_MUSIC_PAD=1` 才允许。
  - 调试全量：`MOBILE_BUNDLE_MUSIC_FULL=1`；限量仍可用 `MOBILE_BUNDLE_MUSIC_LIMIT=N`。
- **R2 铁律（违反会让已上架 App 挂掉）**：本项目的 R2 桶是 `askbible-media`，公开地址
  `https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev`。这个 URL **编译进了已上架的二进制**
  （`goldenVerseAudioRemote.ts`、`musicAudioRemote.ts`、`lib/bible/golden-verse-audio.ts`、
  `lib/app-install-urls.ts` 的安卓 APK 下载链接），所以：**桶名不能改**（`pub-*` 里那串 id 绑的是
  bucket，改名 = 新 id = 旧 App 全部 404）、**r2.dev 公开访问不能关**。它没有成本，让它一直开着。
  以后要换成 `askbible-media.joshlabs.app` 自定义域，是**新增**不是替换：新版 App 用新域名，
  旧版继续走 r2.dev，两边同时活。跨项目规则见
  `/Users/joshua/Desktop/APP/skills/joshlabs-dev/references/infrastructure-cloudflare.md`。
- **移动端发版禁止 EAS 云端构建**：iOS 用 `npm run mobile:build:ios:production`（本机 `--local`），Android 用 `npm run mobile:build:android:production`（本机 Gradle）；流程见 `docs/mobile-release-checklist.md`。
- **App 验收与合入（人不用记）**：改 `apps/askbible-mobile` 时 Agent 按 `.cursor/rules/mobile-maestro-auto-merge.mdc` 自动 Maestro + PR 合入门禁；见 `docs/mobile-maestro-auto-merge.md`。

### 执行节奏

- 小任务：直接做，尽量不展开讨论。
- 中任务：先给一句话计划，再开始执行。
- 大任务：先简短对齐目标，再推进。
- 高风险操作：删除、发布、提审、推送生产前才确认。
- 非高风险改动：默认不反复确认。

### 排查：先分清逻辑错误还是状态错误

遇到问题先判断属于哪一类，**再决定用读代码还是用运行时证据**——这两类的查法完全不同。

**逻辑错误**：条件写反、边界没处理、缓存把失败也存了、异步没判序号。特征是**稳定复现**，
给定同样输入必然同样结果。读代码和补测试是有效的，应该能看出来。

**状态错误**：竞态、资源泄漏、生命周期错位、系统级状态被污染。特征是症状里带
**「有时」「偶尔」「再试一次就好」**。这类问题**读一百遍代码也可能读不出来**，因为错误不在
任何一行里，而在多次调用之间累积的状态里——甚至根本不在本进程内。

**判据很简单：症状描述里出现「有时」，就别从读代码开始，直接上运行时证据。**
Android 用 `adb logcat -v time -s <TAG>` 复现一次，iOS 用模拟器面板，网页用
`read_console_messages` / `read_network_requests`。

真实教训（2026-09-07，金句与音乐互切时「有时放不出声，再关再点才出来」）：

- 两个原生播放器的 `requestFocus()` 每次都 `new` 一个 `AudioFocusRequest`，却只用一个变量存，
  旧的永远 `abandon` 不掉，堆在**系统焦点栈**里；`am.requestAudioFocus()` 的返回值被丢弃，
  被系统拒绝也照样往下播（就是「没声音」）；`setOnAudioFocusChangeListener { }` 是空的。
- 这段代码逐行读**没有一行是错的**，形状和 Android 官方示例几乎一样。忽略返回值不是语法错误、
  linter 不报；空 listener 读起来像「判断过不必处理」而不是「漏了」。
- 定案靠的是 logcat 里的五行：同一时刻五个不同的 `ShellMainNativePlayer$$Lambda@…`
  同时收到 `onAudioFocusChange(-1)`。这没有第二种解释，而仓库里翻遍每一行都看不到它。

顺带一条通用的写法约束：**凡是成对的 acquire/release（音频焦点、数据库连接、监听器、
文件句柄），acquire 前先 release 上一个，并且检查 acquire 的返回值**；回调留空之前先问一句
「是真的不需要，还是我还没想清楚」。

### 验证要看最终产物，不要看源文件

源文件只是**输入**，构建会往里合并你没写的东西。判断「线上/包里到底是什么」，必须去看**产物**。

- **Android 权限**：`AndroidManifest.xml` 里没写 ≠ 包里没有。依赖库自带的 manifest 会在合并时
  并进来。查最终结果用 `aapt2 dump permissions <apk>`（aapt2 在
  `~/Library/Android/sdk/build-tools/*/aapt2`），或读
  `android/app/build/intermediates/merged_manifests/.../AndroidManifest.xml`。
  要删依赖带进来的权限得写 `tools:node="remove"`（仓库里 `USE_FULL_SCREEN_INTENT` 就是这么处理的）。
- **装到设备上之后**再核一次：`adb shell dumpsys package me.askbible`，能看到权限是否 `granted`、
  组件是否真的没了。
- **网页部署了没有**：看 `/app-build.json` 的 id。**不要**用 Accept-Language 比对响应差异来判断——
  只要 `(app-shell)` layout 还读 cookie，响应本来就随语言不同，必然误判成「没上线」。

真实教训（2026-09-07，撤 Android 闹钟）：我看着改过的 `AndroidManifest.xml` 就下结论
「`RECEIVE_BOOT_COMPLETED` 删掉了，所以重启后提醒会丢，需要用户权衡」。跑一次
`aapt2 dump permissions` 才发现该权限**一直都在包里**——`expo-notifications` 自带它和
`NotificationsService` 接收器，开机后由 `ExpoSchedulingDelegate.setupScheduledNotifications()`
把 store 里的排程全部重排。也就是说，我拿一个不存在的问题去要用户做决定。
**结论只能建立在产物上，源文件不足以支撑「包里有没有」这类判断。**

### 打包产物用完即删

APK / IPA / AAB 装到设备并验证之后**立刻删掉，不用问**——同一个版本不会重装第二次，下次都是装更新的版本。

- 删两处：`dist/mobile/` 和 `apps/askbible-mobile/android/app/build/outputs/`（gradle 原始输出，
  同一个包会存两份，各 160MB）。
- 同理适用 `dist` / `build` / `.next` / `DerivedData` / `__pycache__`：纯本地产物，重跑就有。
- **不要**碰 `node_modules` / `.venv` / `Pods`——删了当场要联网重装，打断工作流。

### 防止变大

- 只做当前真正需要的部分，不为了“顺手”扩出周边功能。
- 新功能先判断是否属于核心方向；不确定就先放进 `docs/10-parking-lot.md`。
- 尽量写最小实现，避免抽象过早、通用化过度、把单点需求做成万能系统。
- 保持模块之间低耦合，避免一个改动牵动整站。
- 代码要保持可删：临时方案要能清理，过时功能要能下线，重复逻辑要能合并。
- 定期回头减法，而不是只加不删。

## 技术栈与部署（约定）

| 层级 | 选型 |
|------|------|
| **Frontend（前台 + Studio）** | Next.js **App Router** + **TypeScript** + **Tailwind CSS** |
| **Backend（后端）** | **本地数据优先**：`auth.sqlite` + `data/` 配置文件 + Render Persistent Disk |
| **Deploy（部署）** | **Render Web Service + Persistent Disk** |
| **Mobile App（以后）** | 先 **PWA**；后期再评估 **Expo / React Native** |

说明：Studio 当前可有 **localStorage** 过渡；账号与正式数据写入以仓库与挂载磁盘为准逐步实现。

### 内容与发布（本机优先）

- **真源**：产品文字与原则类内容以 **本机编辑 + Git（含 `docs/`）** 为准；Studio 的生成与整理也在可信环境完成。
- **线上**：站点以 **构建 / 静态分发** 为主，**默认不在生产环境提供「在线管理或在线生成整站内容」**（减小攻击面；当前单人单机时尤其合适）。实现上：在 **Vercel Production**（`VERCEL_ENV=production`）对 `/admin`、`/studio`、`/api/ai` 及 `/api/admin`、`/api/studio` 中间件 **默认 404**；本机 `npm run dev` 不受影响。临时开放线上后台（不推荐）设 `SELAH_ALLOW_ADMIN_IN_PRODUCTION=1`；任意非 development 强制关掉设 `SELAH_DISABLE_PUBLIC_ADMIN=1`（见 `.env.example`）。
- **习惯**：定期将仓库 **push 到远程**，降低单设备丢失风险。
- **凭据**：部署与 CI 用密钥 **权限最小**；不把「随意改站或写生产库」的能力长期铺在多环境或可被公网滥用的入口上。若日后必须开放线上写入口，再在 `docs/` 里单独记录威胁模型与权限设计，**不默认扩功能**。

## 本地开发（减少 Next 报 chunk 丢失）

- 日常：**`npm run dev`**（Turbopack，**不再**每次启动删 `.next`——避免你开第二个终端又跑 `dev` 时，把第一个正在跑的实例的 `.next` 删掉，出现 `ENOENT` / 缺 `[turbopack]_runtime.js`）。
- 卡住或奇怪报错时：**`npm run dev:fresh`**（先 `clean` 再起）。
- 若必须用 Webpack：**`npm run dev:webpack`**（先 `clean`；`next.config` 里 dev 下关闭了 Webpack 缓存）。
- **`dev:hot`** 与 **`npm run dev`** 相同（保留别名）。

### Studio 调试（开发者）

- 右侧 AI 讨论区缓存在浏览器本地；若在开发时**需要重置讨论内容以验证新版交互**，可在开发者工具 Application → Local Storage 中移除键 `askbible-studio-ai-discussion-v1`。请勿在产品界面要求普通用户执行此类操作。
- 讨论记录会在允许的磁盘写入环境下**额外备份到仓库根目录 `studio/ai-discussion.json`**（与 `save-docs` 同一权限：`npm run dev` 默认可写；`next start` 需 `STUDIO_ALLOW_DISK_SAVE` + Bearer）。可纳入 Git 备份；若内容敏感可自行加入 `.gitignore`。

## AI 与仓库

- 本文件供人类与 AI Agent 阅读；Agent 改动代码前应核对上述边界。
- 若用户明确要求“快一点、少解释”，优先遵守本节的执行节奏，但不得突破产品边界与高风险确认要求。
