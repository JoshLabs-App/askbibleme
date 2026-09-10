# 移动端全面原生化路线（纯双写）

**决策日期**：2026-09-08　**决策人**：Josh
**决策**：放弃 React Native / Expo，重写为 iOS（Swift + SwiftUI）与 Android（Kotlin + Compose）两套完全独立的原生 App。
**明确排除**：KMP / 任何跨端共享逻辑层。Josh 要求零共享、两边分开维护，已知晓并接受逻辑双写的永久成本。

---

## 一、现状盘点（2026-09-08 实测）

| 项 | 数量 |
|---|---|
| TSX（UI 层） | 34,091 行 |
| TS（逻辑层） | 71,494 行 |
| 其中测试 | 3,955 行 |
| 合计 | 105,585 行 / 1,022 文件 |
| 已有原生源文件 | 45（Swift + Kotlin，不含 Pods/build） |
| 打包资产 | 167 MB（`assets/`） |

**模块规模（src/）**：read 31.6k · music 15.9k · home 12.5k · explore 11.8k · bible 6.0k ·
shell 4.0k · member-sync 3.1k · auth 2.9k · audio 2.7k · notifications 2.2k · media 2.1k · 其余 < 1.6k

**依赖广度（引用文件数）**：expo-router 93 · AsyncStorage 74 · expo-audio 28 · expo-file-system 20 ·
expo-linear-gradient 14 · expo-asset 13 · expo-video 7 · expo-sqlite 7 · expo-haptics 7 · 其余 ≤ 6

**已完成原生化（终态，不要重写）**
- 播放引擎双端：`modules/askbible-shell-media-controls/ios/*`、`android/.../playback/*`
  （PlaybackEngine / StreamPlayer / MediaSession / AudioFocus / SleepTimer / Notifier）
- Widget 双端：`targets/widget/*.swift`（WidgetKit + SwiftUI）、`android/.../widget/*.kt`（RemoteViews）
- Android Play Asset Delivery：`android/.../music/AskBibleMusicAssetPack*`
- `PlaybackModel` / `JsIntent` 已是 Swift + Kotlin 对等双写，各带单元测试 —— **这是本次重写的样板模式**

**当前环境**：iOS deployment target 15.1（Expo 默认，重写后可上调）· bundleId / package 均为 `me.askbible` ·
App Group `group.me.askbible.shared` · 本地 Xcode/Gradle 构建，不使用 eas build

---

## 二、双写模式的核心纪律

逻辑双写最大的风险不是工作量，是**两端行为悄悄漂移**。已有的 `PlaybackModel` 双写给出了正确样板，全面推广：

1. **每个逻辑单元双写 + 双份单元测试**
2. **共享测试 fixture**：测试用例数据以 JSON 存于 `shared-fixtures/`，Swift 与 Kotlin 测试各自读同一份文件断言同样的期望输出。两端实现漂移会直接测试失败。
3. 只有 fixture 是跨端共享的资产 —— 不共享任何可执行代码，不违背零共享的决策。

---

## 三、三端规则防漂移（Phase 0 硬要求）

网页版（Next.js）与移动端目前共享 `lib/` 下的纯规则文件，移动端 121 个文件引用 `@/lib/...`，
实际指向的是七八个小文件（合计几百行）：

- `lib/bible/scripture-books.ts`（84）
- `lib/bible/reading-plans/nt-deep-repeat-pace.ts`（120）
- `lib/notifications/notification-prefs-types.ts`（91）
- `lib/read/reading-plan-epoch.ts`（37）
- `lib/bible/parse-verse-key.ts`（37）
- `lib/bible/golden-verse-audio.ts`（42）
- `lib/bible/reading-plans/pointer-reading-plan.ts`（7）
- `lib/explore/explore-birth-date.ts` 等

原生化后这些规则会存在三份（web TS / iOS Swift / Android Kotlin）。
**机制**：以 `lib/` 为唯一规则源，codegen 生成 Swift / Kotlin 常量，或以共享 fixture 对拍。
**必须在写下第一行原生业务逻辑之前完成**，否则从第一天起就开始漂移。

---

## 四、阶段路线

顺序原则：先拆接口最窄、最痛的；导航壳最后翻转。**每个阶段结束都必须是可发版状态**，
绝不允许出现"重写中、数月不能发版"。

### Phase 0 — 地基（2–3 周）

**已完成（2026-09-08）**
- 设计 token 对拍：`tools/design-token-parity.mjs`，`npm run check:tokens`
  以 RN 的 TS 为唯一真源，解析各原生端常量逐值比对，不一致即非零退出。
  **已覆盖三端（2026-09-08）**：TS 真源 ↔ Swift ↔ Kotlin，**358 项**（179 × 两端）。
  内容为羊皮卷 light/dark 色板（30 色 ×2）、15 档排版表、读经顶栏 / 播放坞 / 底栏几何、品牌色。
  注入「Kotlin 色板错一位 + Kotlin 几何错一个 + Swift 字号错一个」，三处全抓到，
  且报告能指明是哪一端漂移 —— 这正是三端双写最需要的能力。

  Kotlin 侧的 token 放在 `:core` 且不引 Compose 的 Color（用自定义 `Rgba`），
  这样 core 保持零依赖，对拍能直接文本解析、也能在 JVM 上跑。
- iOS 原生工程骨架：`apps/askbible-ios/`，独立 Xcode 工程，bundle id `me.askbible.native`
  （与 RN 版错开，可并排安装对比），最低 iOS 17，文件系统同步组（加文件不改 pbxproj）。
- 七屏 SwiftUI 骨架跑通并与真机 RN 版逐项核对：首页 / 目录 / 章节选择 /
  阅读章页 / 译本浮层 / 探索 / 音乐。

- 经文标注对拍：`tools/verse-annotation-parity.mjs`，`npm run check:verse-annotations`
  设计 token 是常量、解析源码即可比；标注切分是**算法**，两端必须真跑：
  TS 侧 esbuild 打包 `verse-annotations.ts` 直接 import，Swift 侧把 App 里那份
  `VerseAnnotations.swift` 和 harness 一起 `swiftc` 成命令行，同一批输入比输出。
  **369 条样本**，取自真实库（无标注 / 单段神言 / 单段人言 / 多段 / 从 0 起 /
  长节 / 金句边界）加手写脏输入（坏 JSON、越界、乱序、非法 code、小数、元素不足）
  和 5 条代理对边界。注入「阈值差一」抓到 21 条、注入「字素簇切分」抓到 5 条。

  两处值得记的发现：
  · 内置库 31100 节里**没有任何非 BMP 字符**，所以 UTF-16 与字素簇切分在当前数据上
    无差异 —— 最初的样本抓不到这个注入，是补了 5 条代理对样本才堵上的盲区。
  · span 切在代理对中间时两端必然不同：JS 允许孤立代理项，Swift 的 String 换成 U+FFFD。
    这是语言级差异不是切分错误，比较前做归一化，切分位置真错了照样抓。

- `npm run check:native` 一次跑完两项

- **对拍已扩展到三端（2026-09-08）**：TS 真源 ↔ Swift ↔ Kotlin，369 条样本全绿。
  Kotlin 侧注入「金句阈值差一」抓到 21 处、注入「漏掉 code 合法性校验」抓到 1 处，
  且报告能指明是哪一端分叉。后者只有手写脏输入样本能发现 —— 真实库里不存在非法 code。

  为此做的两个设计决定：
  · Android 拆出 `:core` 纯 Kotlin 模块（零 Android 依赖），`:app` 依赖它。
    对拍因此能在 JVM 上跑，不需要模拟器 —— 与 iOS 侧把 ScriptureStore 拆出去同理。
  · `VerseAnnotations.kt` 不用 `org.json`（Android 专有，JVM 上跑不了同一份代码），
    span 形状固定，手写解析既无依赖、两端行为也完全可控。

**待办**
- 把 `check:native` 接进 CI 与 pre-commit
- Android 端接入对拍（写 Kotlin 常量时同步加解析器）
- 决定重写后的 iOS 最低版本（现取 17；覆盖更老设备需下调，待 Josh 拍板）
- `lib/` 里那七八个纯规则文件（reading-plan、parse-verse-key 等）的对拍
  —— 当前只覆盖了设计 token，业务规则还没有

**验收**：改动真源后，`npm run check:tokens` 能自动发现不一致 ✅（设计 token 部分）

### Phase 1 — 数据层（6–10 周）
`src/bible/` 6k 行 + expo-sqlite 7 个入口 + 167 MB 打包资产 + 翻译下载。
接口最窄、无 UI、所有屏幕的底座。

**进行中（2026-09-08）**
- `Model/ScriptureDatabase.swift`：系统 libsqlite3 直连，`SQLITE_OPEN_READONLY`
  打开 bundle 内的库。省掉 RN 那条「复制到 documents + schema 版本标记 + 失败重建重试」
  的整条链路 —— 只读库不需要落盘副本。
- `Model/VerseAnnotations.swift`：speech_spans 解码切分 + 金句阈值，已进对拍。
- 阅读章页已接真实数据：金句黄底、神言棕红、人言靛蓝均由库中标注驱动。
- 章数改为查库 `MAX(chapter)`。

- 四个内置译本（cuv-simp / cuv-trad / web-en / ust-en）与 xrefs 库全部进包，共 22 MB。
- `Model/ScriptureStore.swift`：从 ScriptureDatabase 拆出。数据层保持纯 Foundation，
  不依赖 SwiftUI —— 这是数据层自检能脱离 App 单独编译运行的前提。
- 交叉引用接入：`XrefDatabase.versesWithXrefs` 的 UNION 查询与 `load-chapter-xrefs.ts`
  一致，驱动节号配色（有 xref 走 verseNum #C98300，无则 verseNumMuted）。
- 译本切换可用，切换后阅读页按 `.task(id:)` 重新取数。
- 数据层自检：`tools/scripture-data-check.mjs`，`npm run check:scripture-data`
  断言四库均可打开、创世记 50 章 31 节、马可 16 章、**四个译本文本互不相同**
  （相同说明装错库或全都回退到了同一个）、xref 能查出结果。

  一个真实的 bug 与修复：译本切换起初不生效，根因是用 `@StateObject` 包装了
  `ScriptureStore.shared` —— @StateObject 的语义是「本 View 创建并拥有该对象」，
  套在单例上订阅不可靠。改成根视图 @StateObject 持有 + environmentObject 注入。

**已补齐（2026-09-08 晚）**
- 副译本（对照）：译本面板第二个下拉可选，章页每节下方多一行 0.82× 字号的 muted 对照文
  （verseContrast 规格），两端均验证。
- xref 详情：点任一节弹「{书名} {章}:{节} · 经文关联」，分「被引用于」/「相关经文」两区，
  每条带目标经文预览，点击跳转该章。标签格式 `{书名} {章}:{起}–{止}`（en dash）。

  iOS 侧一个真实的 bug：弹层起初点不出来，日志里 8 分钟内 61 万条
  「Publishing changes from within view updates」。根因是 `ScriptureStore.loadChapter`
  每次都无条件写 `lastError = nil`（@Published 无条件赋值也会发布），而弹层在 body 里
  逐条调 `verseText` 取预览 → 每条都发布 → RootView 重渲 → 再调 → 渲染死循环，
  SwiftUI 直接把那次状态变更丢了。修法：只在真有旧错误时才清；`verseText` 走纯读路径不碰
  @Published。修后同一操作 0 条警告。**教训：任何会被 view body 调到的方法都不能碰 @Published。**

**待办**
- 译本下载（非内置译本）整条链路未搬 —— 原生版目前是纯内置四译本，下载链路在
  「全面做完」范围内明确记为后续项（涉及账号 / R2 鉴权，需单独一轮）
- **验收**：原生数据层行为与旧实现逐条对拍一致；App 正常发版

### Phase 2 — 音频彻底下沉（3–5 周）

**进行中（2026-09-08）**
- `Audio/ChapterAudioPlayer.swift`：AVPlayer + AVAudioSession(.playback, .spokenAudio)
  + `UIBackgroundModes: audio` → 锁屏与后台继续播；MPNowPlayingInfoCenter 锁屏信息；
  MPRemoteCommandCenter 锁屏播放/暂停/下一章/拖动进度。
- **播放状态只有一份**：`@Published` 直接被 SwiftUI 订阅。RN 版为了让 JS 知道播到哪，
  要原生把状态桥回 JS、JS 再维护镜像 —— `src/audio/` 那 2709 行大半在做这件事，
  也正是「playbackModeRef mirror」「JS want-playing stores」那批 bug 的来源。
  这里没有第二份可漂移。
- 中断处理：`AVAudioSession.interruptionNotification` 打断时停播但保留 `wantsPlayback`
  意图，`.shouldResume` 时才自动续播（对应 RN 版 `shellAudioInterruption.ts` 那套
  DeviceEventEmitter 桥）；`routeChangeNotification` 的 `oldDeviceUnavailable`
  处理耳机拔出。
- 循环模式 off → chapter → all，与 `ReadScripturePlaybackDock` 的 LoopMode 一致；
  非 off 时按钮有 rgba(92,64,48,0.1) 圆底。
- 语速档位 0.75–2x，与 scripture-speed 一致。
- 音源分流：cuv（fhl.net，三位章号补零）与 web-en（theaudiopower，OT/NT 两个 base、
  书名空格转义）。ust-en 无整章音源，与 RN 侧一致，播放键置灰。
- 音源自检：`tools/chapter-audio-check.mjs`，`npm run check:chapter-audio` ——
  编译 Swift 生成 URL 后**逐条发 Range 请求实测**，URL 拼得对不等于拿得到音频。
  覆盖章号补零、OT/NT 分流、书名含空格（雅歌 / 哥林多前书）、无音源译本必须返回 nil。

**已补齐（2026-09-08 晚）**
- 睡眠定时器：音乐页右上角计时图标 → 30 / 60 分钟 / 关闭；到期只暂停不停止
  （与 RN SleepTimerFired 一致）。定时器是壳层级的：朗读与音乐两个播放器一起设。
- **音乐页播放**（`Audio/MusicPlayer.swift` / `audio/MusicPlayer.kt`）：
  - 曲库 `MusicCatalog.swift/.kt` 由 `tools/gen-music-catalog.mjs` 从 RN 的
    `assets/content/music-companion.json` 生成（164 首；`hidden` 过滤、`inferTrackAlbum`
    专辑推断、zh-CN 优先标题）。TS 仍是唯一数据源，`npm run gen:music-catalog` 重生成。
  - 音源分流 `MusicAudioSource`：内置 5 首（每专辑首曲，68MB，与 RN 安装包一致）走包内文件；
    赞美诗 Hymn Commons 直链原样；其余 `/music/uploads/…` 取对象键接 R2 公网 base
    （`pub-f30fb…r2.dev`）。**任何解析结果不许落到 askbible.me**（流量计费），对拍脚本硬性断言。
  - 专辑规则 `MusicAlbumRules`（对应 `musicAlbumPlayback.ts` + `useMusicHomeAlbum.ts`）：
    睡眠 / 专注工作单曲循环、其余整专辑循环；睡眠专辑音量 0.3；切到睡眠自动设 30 分钟定时、
    离开睡眠自动关；起播曲优先内置再退首曲；别名归一（放松→安静、圣诗→赞美诗…）。
  - 队列 = 当前专辑全部曲目，首尾相接；页面显示上一曲 / 当前曲 / 下一曲三行，点上下曲直接切；
    进度条可拖可点；右侧显示总长（RN 音乐页显示总长不是剩余）。
  - 两个播放器互斥：`onWillPlay` 由 RootView 接线，谁开播谁让另一个停。
  - iOS `RemoteControlHub`：MPRemoteCommandCenter 的 addTarget 是叠加的，两个播放器各注册一份
    锁屏按播放两边都响 —— 命令只注册一次，路由给最后一个开播（claim）的播放器。
    Android 侧两个 MediaSession 必须 `setId` 不同，否则同进程直接抛异常。
  - 两端实测：内置曲即点即播；下一曲（R2 点播）3 秒内出声（logcat buffered position 递增）；
    切睡眠专辑 → Rainy Window + 定时图标亮 + 单曲循环亮；切回放松 → 定时自动关。
- 音源对拍 `tools/music-audio-check.mjs`（`npm run check:music-audio`，已挂进 `check:native`）：
  TS（tsx 直接跑 RN 的 `musicAudioRemote.ts` / `musicAlbumCatalog.ts`）↔ Swift ↔ Kotlin 三方，
  15 条 src 用例（百分号编码、大小写、绝对地址取键、非 https 直链、空文件名…）、14 条别名归一、
  7 条专辑规则、12 条起播曲，外加抽两条真实地址发 Range 请求实测。
  注入验证：Kotlin 的 `startsWith` 改不分大小写 → `/MUSIC/UPLOADS/` 用例分叉被抓、归因 Kotlin；
  Swift 睡眠音量 0.3 改 0.5 → rules 分叉被抓、归因 Swift。
  局限：`musicAlbumPlayback.ts` 顶层拉进 react-native，tsx 下装不进来，
  专辑规则与起播曲只做 Swift ↔ Kotlin 对拍（脚本每次会打印这条 WARN，不是静默降级）。

- **首页金句 + 金句音频（2026-09-08 深夜）**：
  - 金句池：RN 的 `theme-repeat-ge5/manifest.json`（4242 节，verseKey + 权重）原样打进两端包，
    不从 sqlite 现算 —— 库里 theme_repeat_count ≥ 5 有 4392 节，比 manifest 多 150 节，以 manifest 为准。
    正文从内置 cuv-simp 库取，再过 `VerseDisplayNotes.strip`（对应 `lib/bible/strip-zh-verse-display-notes.ts`：
    去 `〔…〕` 译注与诗前「（上行之诗）」题注）。**这条是对拍抓出来的**：起初直接用库文，
    抽查 80 节里 6 节诗篇与 RN chunk 不同，都是题注没去。
  - 选句：`HomeVersePool.pickNext` 逐行对应共享库 `lib/home-prayer-pools/pick-next.ts`
    （权重 + 间隔记忆：新句 6h → ×2 → 21 天封顶，72% 概率优先复习）；记忆落 UserDefaults / SharedPreferences。
    Swift 的 `sorted` 不保证稳定、JS 的 sort 稳定，复习分档排序带上原下标才能三端同序。
  - 轮播 / 朗读：不出声时每 10s 换一句；首页喇叭图标开朗读后，一句播完停 5s 再换下一句接着播，
    锁屏继续。音源 `GoldenVerseAudioSource`（对应 `lib/bible/golden-verse-audio.ts` + `parse-verse-key.ts`）：
    R2 直链 `audio/golden-verses/{书}-{章}-{节}-32kbps.mp3`；R2 上没这句（404）当作播完直接跳下一句。
  - 互斥：整章朗读 ↔ 金句（都是人声）；音乐 + 金句可同时出声（RN 首页「音乐+金句 均可」）。
    Android 侧金句播放器 `handleAudioFocus = false`，焦点由音乐播放器持有，不然同进程两个播放器互相掐。
  - 首页那排氛围图标：音符 = 音乐开关（亮 = 在放）、喇叭 = 金句朗读开关、咖啡杯 = 环境音（自然声未搬，只画图标）。
- 金句对拍 `tools/golden-verse-check.mjs`（`npm run check:golden-verse`，已挂进 `check:native`）：
  TS（tsx 直接跑共享库 `golden-verse-audio.ts` / `pick-next.ts` / `strip-zh-verse-display-notes.ts`）↔ Swift ↔ Kotlin：
  16 条经文键（区间、大小写、非法键）；一个 6 节小池子喂 36 个固定随机数 + 12 个时刻，三端必须选出同一串句子、
  留下同一份记忆表、消耗同样多的随机数；90 条去括注（含 NBSP / 全角空格 / 未配对译注等边角）。
  三端的 `\s` 与 trim 定义各不相同（Java `\s` 只认 ASCII，Kotlin `trim()` 不认 NBSP），
  所以三端都写死 JS 的那一份字符集。数据自检：两端 manifest 与 RN 逐字节相同；4242 节全部在库里；
  抽查 4 个 chunk 的正文去括注后与 chunk 逐字相同。
  注入验证四次：Kotlin `P_REVIEW` 0.72 → 0.5 → 选句序列与记忆表分叉被抓；Swift 音频后缀改 64kbps →
  paths 分叉被抓；Kotlin 改用自带 `trim()` → **第一版用例没抓到**（Kotlin 的 trim 恰好也剥 NBSP），
  补了 U+FEFF / U+001F / 双 NBSP 三条边角后才抓到；Kotlin `WS_CLASS` 换回 Java `\s` → 双 NBSP 折叠用例抓到。
  教训：注入没被抓到时先怀疑用例弱，不是庆祝实现一致。

- **首页环境音（2026-09-09）**：`AmbientScenes`（对应 `ambientSceneSlots.ts` + `ambientScenePlaybackGain.ts`
  + `ambientSceneAudioSource.ts`）9 个槽位，R2 点播 + 首次播放缓存到本机（RN 2026-09 起也不再打进包）；
  一个槽位无缝循环（iOS AVPlayerLooper / Android REPEAT_MODE_ONE），音量按 RN 那份响度压平表
  （火 0.056 … 白噪音 0.8）。首页咖啡杯图标弹选景（RN 里选景藏在自然场景选择器里，原生没搬那一层）。
  三路互斥按 `homeGoldenVerseTwoSourceMutex.ts`：开音乐 / 开金句时另外两路都在 → 关环境音；
  开环境音时人声与音乐都在 → 停音乐；整章朗读时环境音不停、压半。
  对拍 `tools/ambient-scene-check.mjs`（`npm run check:ambient-scene`，已挂进 `check:native`）：
  槽位顺序 / 文件名 / 增益 / 默认槽位三端一致 + 9 条 R2 全部 Range 实测。
  文件名表所在的 TS 文件顶层拉了 expo 缓存装不进 tsx，按源码正则抽表（不另抄一份）。
- **Android 前台媒体服务（2026-09-09）**：`audio/PlaybackService`（Media3 `MediaSessionService`）。
  播放器仍住在 Activity 进程里，服务只把四个 MediaSession（chapter / music / golden / ambient）挂上：
  任一会话开播就 `startForeground` 出媒体通知，全停自动降级。之前 logcat 里
  `ActivityManager: freezing me.askbible.native` 就是没有它的后果。金句与环境音本不需要锁屏控件，
  也各挂一个会话只为让服务在只有它们在放时也保住进程。
  实测：开白噪音后 `dumpsys activity services` 里 `PlaybackService isForeground=true`、
  media3 通知带两个动作；按 HOME 退到后台 40 秒，`dumpsys media_session` 里 ambient 会话仍 PLAYING、
  position 持续走，logcat 不再出现 freezing。互斥实测：金句 + 环境音在放时开音乐 → 环境音自动关。
- 音源实测的口径（2026-09-09 改）：R2 是自己的桶，取不到就是失败；Hymn Commons 是第三方站，
  偶尔超时只记 WARN（试两次、每次 15s），不让一次网络抖动把整套 `check:native` 拦下来。

- **读经计划（2026-09-09 深夜）**：这是 Josh 点名要对齐的一块（「现在读经计划没有对齐」）。
  - 纯逻辑 `Model/ReadingPlans.swift` / core `ReadingPlans.kt`（各 ~600 行）逐行对应共享库
    `lib/bible/reading-plans/*` + `lib/read/*`：复活节历元（2026-04-05 为第 1 天）、三种起始方式的日课下标、
    三循环指针（旧约去掉智慧书 / 新约 / 智慧书三轨，按天推进、对齐日历、三轨齐超前才整体裁回）、
    新约深读 52 阶（18 个单元按章切分、7 / 14 / 28 天节奏、按天推进、从进度反推第几天、与日历对齐）。
    日期差用 Howard Hinnant 的 days_from_civil，和 JS `Date.UTC` 一样对 2 月 31 日线性顺延。
  - 目录与文案由 `tools/gen-reading-plans.mjs` 生成：`data/bible-reading-plans/registry.json` 的 11 个经典日课表
    + 代码内置的两个主推计划，zh-CN.json 里 157 条 `pages.read.*` 文案原样进表；11 份日课表 JSON（2.3MB）拷进两端包。
  - 本机状态 `ReadingPlanStore`：偏好 / 三循环进度 / 深读进度 / 已读章，读出来先按 RN 的规则对齐日历
    （`resolveEffectiveTripleLoopProgress` / `alignNtDeepRepeatProgressToCalendar`）。
  - 页面：计划目录（两张主推卡 + 经典日课表）、计划详情（启用框：起始方式 / 深读节奏 / 从第几天开始；
    三循环与深读各自的今日读经、52 阶阶梯、恢复默认）、今日读经页（中央键进入：逐章列表 + 开始收听）、
    目录页脚注（计划名 / 第 N 天 · 起算方式 / 查看更多计划）。
  - 计划流：「开始收听」按今日队列逐章自动播放，一章播完（或按下一章）记已读并顺到下一章。
    两端实测：iOS 从第 158 天「哥林多后书 9 → 诗篇 116 → 申命记 5」顺章、打勾正确；
    三星 S23 Ultra 真机上「开始收听」直接起播哥林多后书 9 且跟读高亮正常。
  - 对拍 `tools/reading-plan-check.mjs`（`npm run check:reading-plan`，已挂进 `check:native`）：
    70 条用例三端一致 —— 历元、三种起始方式、三循环第 1 / 2 / 50 / 157 / 400 / 1200 / 3000 天、
    对齐 / 裁回 / 单轨推进 / 已读章、52 阶全部切分、深读第 1 / 8 / 9 / 365 / 400 / 1500 天、反推、格式、目录顺序。
    TS 侧直接跑共享库（tsx + tsconfig paths），首次就全绿。
  - 没搬的：RN 计划播放页的日历条（前后浏览日期、确认调整进度）、章页末尾的「本节已读，推进 X」面板、
    探索文章链接（探索页功能块按 Josh 决定不放）。
- **探索页功能块（2026-09-09）**：欢迎 / 读经计划 / 数算年日 / 祷告与经文 / 圣经人物 / 历代信经 / 窄门 / 赞美敬拜 / 问答
  九宫格按 Josh 的决定只留网站，App 暂不放（「人物也不要」）。两端已拿掉。
- **真机（2026-09-09）**：Josh 授权两台 Android 真机可做实测。三星 S23 Ultra（720×1544，密度 300）装上原生版跑通首页 /
  今日读经 / 计划流起播。**一个教训**：按返回键时他手机上另一个 App（快速英语 150，正在计时学习）跳到了前台，
  我接下来的一下点击落在了那个 App 上。真机上每一次点击前都要先核对前台包名，不只是截图前。

**已确认不做（2026-09-09）**
- 译本下载：RN 侧 `scripture-translation-download.ts` 注明「主站整本包已下线」，只认目录里显式的绝对
  `downloadUrl`，而 `fetchBibleTranslationsCatalog` 里四个译本的 `downloadUrl` 全是 null ——
  RN 版当前同样下载不了任何译本。原生版就是内置四译本，不再为一条已下线的链路写代码；
  日后主站重新提供整本包时再一起接。
- 其余整章音源分流（YouVersion / ESV）：需要第三方 API 授权，不在内置版范围内。

**待办**
- 金句朗读只做了 cuv-simp 音轨；英文界面回落 web-en 音轨的逻辑（`resolveGoldenVerseAudioTranslationForLocale`）
  等界面多语言一起做

消灭 `src/audio/` 2,709 行。目标状态：JS → 原生只发单向 intent；原生 → JS 只推只读快照，
JS 不派生、不缓存、不补算。
（近期 commit 08491098 / fc9b3fbe / 934b6f3c / 0b218909 / 344b4dae 已在此方向上，继续走完。）
- **验收**：`src/audio/` 剩余行数 < 800；播放状态不一致类 bug 归零

> **Phase 1、2 无论最终是否走完全面原生化，都是净收益，不会浪费。**

### Phase 3 — 第一个原生屏：阅读页（3–5 个月）
`src/read/` 31.6k 行，最大最核心。**故意先啃硬骨头**：若原生化在此失败，损失是几个月而非两年。
以原生 view 嵌入现有 RN 壳的方式渐进替换。
- **验收 / 决策点**：拿到真实数据 —— 开发耗时、滚动与字体渲染表现、bug 密度。
  **若不明显优于 RN 版，在此叫停**，保留 Phase 1/2 成果。

### Android 侧（纯双写，与 iOS 独立）

**已有（2026-09-08）**
- `apps/askbible-android/`：独立 Gradle 工程，applicationId `me.askbible.native`
  （与 RN 版 `me.askbible` 错开，可并排安装对比），minSdk 26 / targetSdk 36，
  Compose + Media3(ExoPlayer)。
- `:core` 纯 Kotlin 模块：`VerseAnnotations.kt` 与 iOS 的 Swift 版对等双写，已进对拍。
- `:app`：`ScriptureDatabase.kt` / `XrefDatabase.kt`，查询与 iOS 侧、与 TS 真源一致。

  一处与 iOS 的真实差异：iOS 能直接只读打开 bundle 内的 sqlite；
  Android 的 assets 在 APK 里没有真实路径，`SQLiteDatabase` 打不开，
  必须先拷到 filesDir（`noCompress += "sqlite"` 保证 asset 不被压缩）。

- 圣经库已进 assets（28 MB，含 4 译本 + xref + 时间轴），数据层在模拟器上跑通真实数据：
  创世记 1 章 31 节，金句 / 神言 / 人言标注与 iOS 侧逐条一致。
- 设计 token（色板 + 15 档排版 + 壳层几何）已写并进对拍。

  一处 Android 独有的坑：assets 拷到 filesDir 后必须与源文件字节数一致
  （实测 cuv-simp 5,013,504 字节一致），靠 `noCompress += "sqlite"` 保证；
  漏了的话 `SQLiteDatabase` 打不开压缩过的 asset。

- Compose 阅读页与底栏已跑通（2026-09-08）：羊皮纸底、分段经文、
  节号按 xref 分色、神言棕红 / 人言靛蓝、金句黄底、底栏 5 图标。
  与 iOS 版逐项一致 —— 两端从同一份 SQLite 出发、各自独立实现，渲染同一结果。
  几何全部取自 core 的 `ShellMetrics`（已被 check:tokens 锁住）。

  两处 Android 独有的坑：
  · `enableEdgeToEdge()` 之后没有 iOS 那样的 safe area 自动处理，
    顶栏必须自己加 `statusBarsPadding()`，否则图标钻进状态栏。
  · 底栏默认透明，滚动内容会从底下透出；要自己铺羊皮遮罩
    （iOS 侧是用 `safeAreaInset` 解决的，两端手段不同）。

- **音频完成（2026-09-08）**：ExoPlayer + MediaSession，播放坞与跟读高亮跑通。
  实测创世记 1 章播到 0:11 时第 1 节高亮（时间轴 7.15–12.04s），与 iOS 一致。

  与 iOS 的实现差异（同一需求两端手段不同，纯双写的日常）：
  · 音频焦点：iOS 用 `AVAudioSession.interruptionNotification` 自己处理；
    Android 用 `setAudioAttributes(handleAudioFocus = true)` 交给 ExoPlayer。
  · 锁屏控制：iOS 是 `MPRemoteCommandCenter`；Android 是 `MediaSession`。
  · 进度回调：iOS 有 `addPeriodicTimeObserver`；ExoPlayer 没有等价物，
    用协程轮询（250ms，与 iOS 间隔一致）。
- 音源解析与跟读定位算法放在 `:core`，已进对拍：
  `check:chapter-audio` 现在先比两端 URL 逐条一致、再实测可达；
  `check:verse-timings` 增加两端定位算法在 13 个探测点上的比对。

  三个 Android 侧踩到的坑：
  · `ExoPlayer.Builder(...).apply { addListener { isPlaying = ... } }` 里的 `this`
    是 ExoPlayer，`isPlaying`/`duration` 会解析到它自己的只读属性 —— listener 要写在 init。
  · `ParchmentBackground` 默认 `fillMaxSize`，用作某块内容的背景会撑满全屏、
    盖掉其他内容（与 iOS 侧 `.scaledToFill()` 撑大容器是同一类错误，两端各踩一次）。
    修法：加 `fillScreen` 开关，配合 `matchParentSize()`。
  · 速度标签 `"%.2fx".format(rate).trimEnd('0') + "x"` 会拼成 `0.75xx`。

- **阅读流程闭环（2026-09-08）**：目录 → 章节选择 → 章页，实机跑通。
- 圣经目录补全到 66 卷（两端原先都只有 39 卷），数据从 `lib/bible/scripture-books.ts`
  生成后由 `check:book-catalog`（465 项）锁住。分组名与配色是 App 设计、不参与对拍，
  但两端划分必须一致且并集不重不漏。

  对拍脚本本身修过一处缺陷：早前「卷数不符」会 `continue` 掉同端后续字段、
  再用 `if (length ===)` 卡掉两端命名比对 —— 注入三个 bug 只报一个。
  真出问题时这会让人修完一个以为完事。现在结构问题与字段问题并列全报。

- **七屏齐全（2026-09-08）**：首页 / 目录 / 章节选择 / 章页 / 译本面板 / 探索 / 音乐，
  与 iOS 逐屏对齐。译本切换后章页重新取数。

  排查记录：截图两次拍到白屏、两次拍到 RN 版界面。前者是 App 冷启动超过 6 秒；
  后者是**模拟器被另一个会话共享**（RN 版日志时间戳与截图重合），我的进程没崩，
  只是前台被抢。教训：每次截图前先核对 `dumpsys activity` 里的前台包名，
  不能默认前台就是自己。

- **返回键（2026-09-08 晚）**：Compose 弹层是普通 Box，不接管系统返回键，之前按一下整个 App
  直接退出。`BackHandler` 按层级逐层收起：弹层 → 章页 → 回首页，到首页才真正退出。
- 底栏羊皮底改铺整个「坞 + 底栏 + 导航栏 padding」：只铺底栏那一行时，系统导航栏区域会透出
  滚过的经文（iOS 侧同样把底铺到 dock 与底栏之间 6pt 的间隙）。
- 目录书名 `1 Thessalonians` 曾只剩「1」：Compose 的 `maxLines = 1` 默认仍在空格处折行再截断，
  要 `softWrap = false` + `Ellipsis`（iOS 的 `lineLimit(1)` 默认就是截断加省略号）。

**待办**
- 译本下载与 iOS 同步推进；后台前台服务见 Phase 2 待办

### 版面对齐 RN（2026-09-09，两端同步）

Josh 拿 RN 版创世记 2 章截图对照，指出章页与底部图标「明显没有对齐」。逐项对齐后的结果：

- **章页连排**：RN 默认 `verseParagraphFlow = true`，一段里各节接排成一块文本，不是一节一段。
  分段元数据（小标题 + 段落起点）由 `tools/gen-chapter-segments.mts` 用 RN 的
  `loadBundledChapterSegments(book, ch, "t1")` 生成 `chapter-segments.json`（1189 章 / 3037 个小标题 /
  13383 个段落起点，108 KB），两端各带一份；`ChapterSegments.paragraphGroups` 对应 RN `buildParagraphGroups`。
  · iOS：`ChapterFlowParagraph` 用 TextKit 自绘进普通 UIView（不用 UITextView，少一层滚动视图和文本手势），
    `layoutManager.characterIndex(for:)` 反查点到哪一节，跟读高亮是该节字符区间的 backgroundColor。
  · Android：`ChapterFlowParagraph` 用 `AnnotatedString` + `getOffsetForPosition` 反查，`SpanStyle(background)` 高亮。
  · 数值全部照搬 RN 样式：节号 700 / 正文 500 inkSoft、节号间隔 iOS en space / Android em space、
    小标题 字号+1 行高+2 `#70451F` 600 字距 0.3 上 18 下 16、段间 16（带小标题时 22 + 96 宽发丝线）、
    段块下距 14；标题「书名 第N章」600 居中、下 24 + 发丝线 + 12；
    结尾「‹ 第N章 | 书名 | 第N章 ›」（上 80 下 50，13/500 faint，书名 16/600 ink）+ 28 高渐变收尾。
  · 上一章 / 下一章可跨卷（对应 `read-chapter-neighbors.ts`）；手动翻页退出计划流。
- **图标改用 RN 同款字形**：RN 壳层图标全部是 `@expo/vector-icons` 的 MaterialIcons / MaterialCommunityIcons，
  SF Symbols / Compose material-icons 的同名图标形状并不一样（Josh 一眼就看出来）。
  现在两端内置同两份 TTF 按同码位渲染（iOS `MaterialIcon.swift` 运行时 `CTFontManagerRegisterFontsForURL`，
  Android `MaterialIcon.kt` 从 assets 建 `FontFamily`），底栏 / 中央键 account-voice / 顶部按钮 / 播放坞 /
  首页氛围行 / 音乐页专辑与传输键全部换过。播放坞的语速档用 RN 的预渲染图 `scripture-speed-*.png`（tint 成 ink），
  循环键按 RN 的 react-native-svg 路径自绘（四分之一圆用三次贝塞尔近似）。
  目录行的「›」和章节选择器的「×」在 RN 里是文字不是图标（24/faint .58、28/faint），也照搬；
  约首切换键是 notes 22。返回键按 RN 的 HeaderBackButton：iOS 系统 chevron、Android arrow-back。
- **播放坞**：坞顶的线按 RN 改成 1 物理像素的 border 色发丝线（之前是 1pt 实线，Josh 说「原来没有横线」）；
  坞不再自己铺羊皮底，由底栏宿主连坞带底栏一起铺 —— 两层羊皮纹错位会在坞底露出一条接缝。
  进度轨 `rgba(92,64,48,.22)` / 填充 LOGO 黄，右侧显示总时长（RN 无时长时为 `—:—`）。
- 实测：iOS 模拟器 + Android 模拟器（真机当时未连）。章页滚动、点节弹串珠、上一章 / 下一章跨章回顶、
  跟读高亮（0:31 时第 4 节黄底并滚到中部）都过；`check:native` 全绿。

  两处排查记录：
  · iOS 章页一度「滑不动」，怀疑 UITextView 吞掉拖动而改成自绘 —— 后来查明是模拟器滑动起点
    落在播放坞上（y=750pt 已进坞区）。自绘版本保留，但原因要记对。
  · 换章后标题曾顶到视口边缘：`scrollTo` 锚在标题上会把 59pt 顶距滚没，锚点要放在最顶上的零高视图。

### 羊皮底纹 + 探索页查经资料（2026-09-09 晚，两端同步）

- **羊皮底纹改回 RN 的画法**。Josh：「背景羊皮卷是一个重要的底纹，大部分版面都需要用」。
  RN `ReadParchmentFillLayer` 是把羊皮 JPG **整张实图**按屏幕尺寸 stretch 铺满；我们之前是 canvas 底色上 multiply 叠 42%，
  纹理被压得几乎看不见。两端 `ParchmentBackground` 改为实图铺法（同一张 read-parchment-scroll-bg.jpg，30 KB）。
- **弹层也铺羊皮**：RN 的 `ParchmentModalCard` 是羊皮 JPG 按整屏尺寸铺、由圆角卡片裁切（露出整图左上角那块，纹理与页面连续）+ hairline 描边。
  两端各加 `parchmentCard(cornerRadius:)`（iOS ViewModifier / Android Modifier.composed + drawBehind），
  章节选择 / 译本面板 / 串珠 / 定时器 / 环境音五个弹层全换掉了原来的纯色底 `#faeeda .97`。
- **探索页接进查经资料**（Josh：「两个版本的内容接进来 探索 查资料」，按「中英两版文章包接进探索页」理解）：
  真源 `data/explore-featured-articles/bundle.json`（4 篇：让经文自己发声 / 圣经中的查经模型 / 轻松读经 / 麦克阿瑟的研读法，zh-CN + en），
  `tools/gen-explore-articles.mjs` 复制进两端 + 生成 `ExploreArticleCatalog`（slug → MaterialCommunityIcons 码位 / 长文版式），
  `check:explore-articles` 锁住。探索页按 RN 的格子摆文章瓦片（3 列 gap 10、64 圆角 18 浅底圈 + 28 图标 + 12/600 标签），
  读经计划器的占位文章「轻松读经」与 RN 一样不进格子。
  · 文章页对应 RN ExploreArticleScreen：顶距 40、系统返回、标题 24/600 + 发丝线；Markdown 子集自渲染
    （段落 / ## ### #### / 无序有序列表 / 引用 / 分隔线 / 表格，行内粗体与链接），字号随阅读档位 textScale = verseFontSize/16，
    样式数值照搬 ReadChapterInfoEditionMarkdown（body 16/30、h2 18/30、h3 16/27、强调色 #A56A2D、引用 #8C562A 左线 3、
    无序列表不带圆点、hr 不画）。iOS 行内用 `AttributedString(markdown:)`，Android 自己切粗体 / 链接成 `LinkAnnotation`。
  · 文章里的经文链接 `/read/MAT/12?verse=3` → 切到读经 Tab 直接开那一章（实测两端都通）；`/explore/articles/<slug>` → 开另一篇。
  · 目前只取 zh-CN 版展示，en 版随包一起带着，切语言时可直接用。
  · 未接：RN 探索页的问候名编辑、阅读习惯统计真实数据、九宫格功能块（按 Josh 决定只留网站）。

### 章末「读后两版」入口：陪你探索 / 查找资料（2026-09-09 深夜，两端同步）

Josh 澄清：「读经结束后，会有两个入口，可以去一起探索与查资料」—— 即 RN 章页结尾的 `ReadChapterPostReadingEditions`：
两张书脊卡「陪你探索」（发现版 V2）/「查找资料」（讲解版 V1），点开在下方铺出该版正文。前一节「探索页查经资料」是我理解偏了，
那部分保留（探索页的文章瓦片本身在 RN 也有），这一节才是他要的。

- **内容库**：RN 同一份 `assets/content/info-edition.sqlite`（26 MB，4761 行，两版各 1189 章，键「书卷:章:角色」，
  info = `info_edition_v1`，guide = `role_356f0ffb` 发现版 V2；旧式「书卷:章」键做回退并校验角色）。产物不入库，
  `npm run gen:info-edition` 从 RN 资源复制到两端（同时复制两张入口插画），gitignore 已加。
  iOS 只读直开 bundle；Android 先拷到 filesDir（noCompress 已含 sqlite）。
- **归一化规则**三端对拍：`InfoEditionFormat`（Swift / Kotlin）逐条搬 RN `info-edition-format.ts`：去 code fence、首个标题升 H1
  其余 `#` 降 `##`、贴着标题 / 边界 / 另一条的 `---` 丢掉、行尾双空格软换行合并、首行强制 H1、旧式「X第N章导读」标题、
  嵌套列表拉平；查找资料再删「关键画面」版块；最后 `splitPrimaryHeading` 摘页头。`check:info-edition`（已进 check:native）：
  8 章 × 两版真实内容 + 16 条合成用例，Swift ↔ Kotlin ↔ TS 三端一致；两端 sqlite 与 RN 字节一致。
  注入测试：Swift 软换行阈值改 3 空格、Kotlin 改成 guide 版删关键画面，都被抓到。
- **版式**照搬 RN：标题「继续阅读与思考」22/600 字距 .8、引导语 13、提示 12/500、56% 宽发丝线；两页各半，
  方形插画 stretch 80%、标题 17/600 `#A56A2D` 字距 .6、简介 11、「点按打开 ›」/「已选择 ✓」；展开块：免责声明 12 →
  通屏壳（最小一屏高，顶部 15 的暗影）→ 纸面卡 `#F2E4CF` 圆角 18 边 rgba(150,112,64,.18) 投影 → 页头 24/700 强调色 +
  Markdown（复用探索文章那套 MarkdownBody，正文色 rgba(28,20,16,.82)）→「返回」14/600；再下「上一章 / 回到顶部 / 下一章」。
  字号随阅读档位 textScale = verseFontSize/16。换章清空展开状态。经文链接 → 直接开章。
- 实测两端模拟器：创世记 2 章 / 帖撒罗尼迦后书 2 章的发现版都正常铺开，返回、回到顶部都通。
- 未接：RN 的纠错入口（需要账号）、英文角色（`prefersEnglishInfoEdition`）、宽屏双栏（spread）版式、章末「本章已读」面板。

### 坞顶硬边 → RN 的渐隐（2026-09-09 深夜，两端同步）

Josh：「原版这里是没有明显横条的，是一点透明渐变的」。查 RN：
- 底栏宿主本身透明；只有读经坞出现时才在坞 + 底栏后面铺羊皮 —— 而且铺的是**与页面同一张、按整屏尺寸钉在屏幕底**的羊皮图
  （`scriptureDockParchmentHost` + `ReadParchmentFillLayer pinBottom`），像素与页面底图完全重合，所以看不出接缝，只剩坞的发丝线。
  我们之前是把一张按宿主尺寸拉伸的羊皮铺在坞后面，纹理错位就成了一条硬边。
- 滚动页用 MaskedView 做顶 / 底渐隐（`readParchmentScrollMask`）：章页 `chapter` preset 只有顶部 70 的渐隐（底部由坞遮）；
  目录 / 探索等 `tabbar` preset 顶 70、底 120，贴近底栏 80 处只剩 3%，正文从透明底栏下面渐隐着滑过去。
  内容照 `readParchmentFadeSafePadding` 多留顶 70 / 底 120，底部再加 72（SHELL_TAB_BAR_CLEARANCE）+ 安全区。

两端实现：`ParchmentFade`（iOS `.mask` + 按视口高度算的 stops；Android `graphicsLayer(Offscreen) + drawWithContent(DstIn)`），
`ParchmentPinnedBottom`（整屏图钉底裁切）。目录 / 探索 / 文章页的滚动视口改成从屏幕顶到屏幕底（状态栏高度并进内边距）。

两处踩坑，各花了一轮：
· iOS `.clipped()` 只裁画面不裁点击 —— 整屏大的 overlay 把上面所有页面的触摸都吃掉（目录页点不动、今日页也点不动），
  装饰层必须 `.allowsHitTesting(false)`；另外 dock 闭包总是给的，得另传 `dockActive` 才知道坞真的在。
· Compose `Canvas` 默认不裁切 —— 整窗口大的 drawImage 画到宿主外面、把章页整页盖成空羊皮，必须 `clipToBounds()`。

### 经文搜索 / 收藏 · 译本偏好落盘 · 首页场景与音效（2026-09-09 午后，两端同步）

Josh：「搜索 收藏 这些要做出来」「搜索关键词有高亮 也是用弧形」「首页 咖啡是另一个音频专辑 不是环境音，
首页的选场景与环境音也做出来，跟原来页面一致」。

**搜索页**（`SearchView` / `SearchScreen`，对应 RN `ReadScriptureSearchScreen`）：LIKE 查询带 `ESCAPE '\'`，范围 全本 / 旧约 / 新约 / 本章
（旧约 = 书序 ≤ 39），上限 40、范围内先取 120 再筛，`ORDER BY book_id` 字符串序（RN 就是这么排的，照抄不「修」），
输入停 360ms 查库，最近搜索封顶 8 条（键 `askbible-mobile-scripture-recent-searches-v1` / `…-search-scope-v1`）。
命中经文关键词 ink 700 + `verseBookmarkMarker` 底；底色不走文本 span（只能方角）：iOS `RoundedHighlightText` 用 TextKit 自绘、
逐行圆角 4、按字体行高收口（行框带 lineSpacing，中间行会比末行高一截）、截 4 行时用 `truncatedGlyphRange` 把省略号后面的命中剔掉
（第一版把框画到了「…」上）；Android `onTextLayout + drawBehind` 逐行圆角 4，`getLineEnd(visibleEnd)` 之后的不画。
段落样式一写 `byTruncatingTail` 整段就只排一行 —— 截行只能交给 container 的 `maximumNumberOfLines`。

**收藏**（`VerseBookmarkStore`，键 `askbible-scripture-verse-bookmarks-v1`，条目键 `translationId:bookId:chapter:verse`）：章页双击收藏
（新加顺手复制，轻提示「已收藏，经文已复制」/「已取消收藏」）、长按操作单（本节复制 / 双击收藏 / 分享；RN 还有多选复制、划重点，未接）、
收藏页（书名 章:节 · 译本 + 经文 4 行 + 右侧 bookmark 取消）。已收藏节正文逐行铺 `verseBookmarkMarker` 圆角 2 且不再画跟读高亮（RN `audioActive = !bookmarked && …`）。
复制格式「书名 章:节 经文」，分享「书名 章:节⏎经文」。搜索 / 收藏页盖在章页上时坞藏起来（RN 非章页只在播放中出坞）。

**译本偏好跨启动记住**：`TranslationPrefsRules`（Swift / Kotlin core），键与格式同 RN `read-bible-translation-prefs.ts`：
`selah_read_bible_translation_v1` = `{"version":1,"primaryTranslationId","contrastTranslationIds":[…],"audioTranslationId":null}`；
原生只接一路对照，读回取第一个合法且 ≠ 主译本的 id（老字段 `contrastTranslationId` 也认），写回与 RN `JSON.stringify` 逐字节相同。

**对拍**：`check:scripture-search` 扩到 62 条（tpparse 18 · tpser 4），TS 端把 `read-bible-translation-prefs.ts` 去 import 拼桩加载。
边角：`version` 为 `"1"` / `true` / `1.0`、`contrastTranslationIds` 为 null / 字符串 / 含非串项、老字段回退、白名单外的默认。
抓到过 Kotlin `optInt("version")` 把 `"1"` 当 1、Swift `as? Int` 把 `true` 当 1 —— 都改成按类型判数字。

**首页**（`HomeView` / `HomeScreen`，对齐 RN `HomeNatureScreen`；Android 上午已做，iOS 这轮补齐）：
- 底图 = 场景循环视频（iOS `AVQueuePlayer + AVPlayerLooper`，Android ExoPlayer `REPEAT_MODE_ONE`；静音、aspectFill、首帧前透明让海报顶住、
  退后台暂停）；「模糊」= 关 live 只看柔焦静帧。素材 9 景 × 海报 / 柔焦海报 / 720p mp4 随包（`tools/gen-nature-scenes.mjs` 从 RN assets 复制，
  ~33MB 不入库；iOS 文件名带 `nature-poster-` 等前缀，因为文件系统同步组把子目录摊平进包根、两类海报同名会撞）。
  `NatureScenes` 表（顺序、标题、默认环境音、activeVideoId、55 档字号、睡眠档位循环）两端手写，`check:nature-scenes` 对拍 `nature-settings.json` 与素材齐全。
- 右上齿轮展开「字号 − / + · 定时」行（定时亮 LOGO 色 + 角标分钟数，0→15→30→60→120→0，四路播放器同一份）、环境音九槽
  （36，间距 16，选中 LOGO 放大 1.06，其余白 .6，选中项滚到居中）、场景条（首格「模糊」，64 圆图，未选中缩 .9 / .6，
  按点选次数排序 `sortNatureScenesByUsage`）；闲置 7 秒自动收起；齿轮在展开中或环境音开着时点亮。
- 点选场景：记次数、存档（键 `askbible-mobile-nature-active-scene-v1` 等与 RN 同名）、跟场景默认环境音（`ambientSceneSlots` 表）。
- 最下一排 = RN `HomeNatureAlbumStrip`：安静专辑 / 金句朗读 / 下午茶专辑，触控 52、间距 28、图标 36。**咖啡杯是「下午茶」专辑不是环境音**（Josh 纠正，
  iOS 原来点咖啡杯弹的 `AmbientSheet` 删掉）；点已在放的专辑停、点另一张切过去起播（`homeNatureAlbumPress`），看按下前的播放态、不等播放器心跳。
- 金句随字号档缩放（`HomeVerseTypography(scale:)`）。

**实测**（两端模拟器）：展开 / 收起、定时角标 15、下午茶起播（Android media_session：`Dancing in the Afternoon Light · 下午茶`，
选景后环境音「水」同时在放）、选景切视频 + 默认环境音 + 场景条重排；搜索 `love`（WEBP）圆角高亮、四行截断；译本跨启动记住（两端杀进程重开面板仍是 WEBP）。
Android 双击手势 adb 两次 `input tap` 间隔超过 300ms 测不到，走长按操作单的「双击收藏」验证同一条链路。

未接：横屏沉浸、场景轮播（`SCENE_LOOP_ALL`）、TTS 语音键、首页设置面板（`NatureHomeSettingsPanel`）、环境音主音量、金句字体 / 效果选择。

### 读经计划页为手机重排（2026-09-09 下午，两端同步）

Josh：「读经计划里面的介绍、内容，全面优化一下，为手机查看优化，不要字太小、太多，整体简介、可视」。
原来两端都是照 RN 逐字搬的：11–12 号说明段落一大片、单选点 16、按钮 12 号字，手机上确实看不动。

**文案层**：新加 `data/bible-reading-plans/mobile-brief.zh-CN.json`（原生专用，不动 RN / 网站的 zh-CN.json）：每个主推计划一条徽标
（方法一 · 轻松读经 / 方法二 · 正式研读）、一句话、三颗要点 chip（图标名 + 短句）、三条「怎么读」、一段长版说明；经典日课表的
一句话取 blurb 第一个分句，chips = 天数 / 单日段数；界面短语（今日读经 / 开始使用 / 了解更多 / 选一种深度…）放 `ui`，
`tools/gen-reading-plans.mjs` 一起生成进两端 `ReadingPlanCatalog`（`ReadingPlanEntry` 多了 badge / tagline / facts / how / detail，
`PlanCopy` 多了 `mobile.*` 键；`check:reading-plan` 的 catalog 用例只比 planId 序，仍然通过）。

**版面**（`PlanWidgets` 两端同名同构）：字号下限 14（Josh 看过第一版后问「可视文字会不会太小」，整套再抬一档），正文 16–18，标题 20–28；
- 目录页：标题 + 一句引言；主推卡 = 徽标 / 标题 24 / 一句话 16 / 要点 chips（放不下折行：iOS `PlanFlowLayout`，Android `FlowRow`）/ 查看 ›，
  当前计划卡角上「✓ 当前计划」金胶囊；经典日课表 = 标题 18 / 英文表名 13 / 一句话最多两行 / chips。
- 详情页：徽标 / 标题 28 / 一句话 / chips / 当前计划胶囊 → 「今日读经」三张轨道卡（旧约蓝 · 新约橙 · 智慧书绿圆底图标，
  书章 22/700，整卡可点进章；深读的新约卡带本阶进度条）→ 「开始使用」（深读节奏三格 7 / 14 / 28 天 + 「一年 · 读 7 遍」，
  经典表的起算方式两格，「从第几天开始」44 触控步进器，整宽 52 高主按钮）→ 「怎么读」三行金色圆底图标 + 16 号短句
  → 深读的「新约 52 阶」进度条 + 当前阶 + 「展开全部 52 阶」→ 另一条路线卡（想读得更深？/ 刚开始读经？）
  → 「了解更多」折叠（长版说明、默认起算日与今天第几天、恢复默认进度）→ 在圣经首页查看今日经文。
- 三循环已是隐式默认时不再显示「设为当前计划」；起算 / 推进 / 阶梯规则一行没动，只换排版与文案层级。
- 计划目录 / 详情 / 今日读经是独立子页，不放底栏（Josh「独立页下面无需放图标」）：iOS `ShellTabBarHost(showTabBar:)`、Android 根布局按 `readRoute` 判断；章页打开后底栏照常回来。

实测（两端模拟器）：目录页、三循环 / 正式研经 / 经典日课表详情；第一版三颗 chip 挤在一行时被压成竖排 —— 改成折行。
文案按 Josh 的意思去掉「不补读」这个说法：要点 chip 改「随时跟上」，引言改「不打卡，别担心漏读。」，「怎么读」与深读长说明里改「停了再回来，别担心漏读」。

### 语言展示逻辑（2026-09-09 下午，两端同步）

Josh：「圣经页如果选英文版本，是不是这一页就全面显示英文，而不是标题是中文、圣经是英文」
「全面查一下不同语言下各版本是否正确显示，把语言展示逻辑梳理清楚，用正确常规的操作逻辑」。
之前原生是两处硬编码：目录永远英文书名（Holy Bible / Torah / Genesis），章页永远中文标题与中文小标题 —— 选 WEBP 就成了「创世记 第1章」配英文经文。

**规则（照 RN，三层）**
1. 界面语言 `AppLocale`（en / zh-CN / zh-TW）跟系统语言走，不另设开关：zh-TW / zh-HK / zh-MO / 带 Hant → 繁体，其它 zh → 简体，其它 → 英文
   （RN `mapLanguageTagToAppLocale`；iOS 取 `Locale.preferredLanguages[0]`，Android 取 `configuration.locales[0]`，系统改语言即时生效）。
2. 读经展示语言 `ReadDisplayLocale`（RN `resolveReadDisplayLocale`）跟**主译本**走：英文译本 → 英文面；中文译本 → 中文面，繁简按界面语言；
   译本语言未知 → 跟界面语言。不因为选了英文译本就把整个 App 界面改英文。
3. 经文语境里的一切都按展示语言：目录页「圣经 / 旧约 / 新约」+ 十个分组名 + 书名，章节选择器书名，章页标题（「创世记 第1章」/「Genesis 1」）、
   分段小标题（中文面用故事化 T1，英文面只用 USFM 的英文 T1，没有就不出，577 处；`chapter-segments.json` 新增 `he`）、章末「第N章 / Chapter N」，
   搜索结果与收藏里的书名，串珠弹层的书名，复制 / 分享 / 收藏 / 锁屏标题里的书名。繁体面把简体文案过 `ZhTw.convert`（RN toZhTwText 同算法：
   词组 → 逐字 → 后/里/仆等多义字修正，表由 `tools/gen-locale-tables.mts` 从 RN 三张表生成）。
   读后两版（陪你探索 / 查找资料）只有中文内容，英文面不出（RN 英文面走英文版本，未接）。
- 读经计划页、搜索 / 收藏页的界面文字、首页金句仍是中文界面（RN 那几页也是按界面语言而非译本）；原生 App 目前没有英文界面文案，
  系统语言为英文的手机会看到中文界面 + 按译本走的经文语境 —— 全套界面 i18n 是下一步单独的活。

**实现**：`AppLocale.swift` / `AppLocale.kt`（AppLocale、ReadDisplayLocale、ZhTw、ReadChrome、BookRef.name(locale)、BookGroup.title(locale)），
`LocaleTables`（66 卷繁体名、10 个分组三语、目录三语、466 字 + 149 词组 + 12 修正），`ScriptureTranslation.language`，`BookGroup.id`（canon sectionId）。
对拍 `tools/locale-check.mjs`（`npm run check:locale`，已挂进 `check:native`）：51 条用例三端一致（语言标签 14 · 展示语言 11 · 简繁 10 · 书名 10 · 标题 / 章标 6），
TS 端把 `i18n/config.ts`（拉了 react-native）与 `site-copy.ts`（拉了 locale-store 和两份 JSON）去 import 拼桩加载。
实测：两端模拟器 WEBP 下目录 Holy Bible / Torah / Genesis、章页 Genesis 1 + Creation + Chapter 2、无读后两版；切回和合本即中文面。

### 读经计划可用性（2026-09-09 下午）

Josh：「读经计划测试一下是否各个计划是正常可用的，包括不同中英文版本的打开」。
新增 `tools/reading-plan-usability-check.mjs`（`npm run check:reading-plan-usability`，已挂进 `check:native`）：12 个计划的每一天每一段，
书卷在目录里、章号在范围内、简体 / 繁体 / WEBP 库里都有这一章（两端 sqlite 同一份）。抓到日课表的真 bug：上游把单章书卷的**节**当**章**
（"Obadiah 15-21" → 第 15–21 章；俄巴底亚书 / 腓利门书 / 约翰二三书 / 犹大书共 17 段），点进去会开到不存在的章。修在解析器
`lib/bible/reading-plans/parse-english-passage-label.ts`（单章书卷的 A-B 当节区间：第 1 章 A–B 节），并重写了四份 built JSON（RN / 网站共用）。
UST 只有 56 卷：10 卷（民数记 / 历代志上下 / 传道书 / 以赛亚 / 耶利米 / 以西结 / 但以理 / 阿摩司 / 撒迦利亚）在 UST 下没有正文，
计划点进去章页是空的 —— RN 那边会回退到同语言内置译本（WEB），原生尚未做这个回退（见待办）。

### 译本目录接「之前的接口」+ 有朗读的放出来（2026-09-09 下午，两端同步）

Josh：「圣经版本页的圣经版本，需要调入 API，需要之前的接口，然后再检查一下 API 里有音频的要放出来」。
查 RN：生产基址是 askbible.me 时 **明确不从主站拉目录**（`remoteCatalogUrls` 直接返回空，主站 `/api/mobile/bible/translations` 也是 307 到网页），
所以 RN 生产包里的「API」就是代码里的 `OFFLINE_BUNDLED_INDEX`（23 本）；正文三条路：内置 sqlite（4 本）、R2 按需下载整本 sqlite（KJV，2026-09 起不再打包）、
在线逐章 —— 设备直抓 bible.com 公开章节页（YouVersion 14 本中文 + NIV，`lib/bible/youversion-chapter-page.ts`），ESV / NLT / NKJV 要带密钥的 API，生产包拿不到。
朗读：`translationSupportsChapterAudio` = 和合本两版（cuv*）/ WEBP / KJV / blm-es / ESV，YouVersion 音频已验证集为空（bible.com 音频页 2026-09 加了反爬）。

**做法**：`tools/gen-translation-catalog.mts` 把 RN 那份目录 + YouVersion 版本号 / 缩写 / 页面语言表 + R2 下载表 + 朗读判定 + 选择器顺序 + 短标签
一起生成进两端 `TranslationCatalog`（20 本：内置 4 · 下载 1 · 在线 15；有朗读 4：cuv-simp / cuv-trad / web-en / kjv），`check:translation-catalog` 保证不过期。
- `ScriptureTranslation` 多了 delivery / provider / remoteId / pageLocale / abbreviation / downloadUrl / hasChapterAudio / 三语短标签；`all` 是全目录，`bundled` 只剩过滤。
- `RemoteChapterStore`（两端）：抓页顺序、两次请求（先不带 UA、太短再带浏览器 UA）、flight 载荷切片、三种节标记正则、去脚注 / 交叉引用、
  RSC 尾巴截断、垃圾文本判定 —— 逐段照 RN；抓到落盘 Caches/remote-chapters，下次离线可读。实测 bible.com 文字页当下可抓（GEN.1 200 / 72 个 data-usfm）。
- `TranslationDownloader`（两端）：KJV 整本 sqlite 从 R2 拉到 Application Support / filesDir，`ScriptureDatabase` 先找已下载再找内置。
- 章页取数改异步（`ScriptureStore.loadChapterAsync` / `ChapterLoader.load`）：内置瞬时读库；下载型先下再读；在线抓页；取不到出「请检查网络后重试」。
  搜索只能查本机库：在线译本回退到同语言内置译本（cuv-simp / web-en）并在页上说明。串珠预览对在线译本只看已抓到的章。
- 译本面板：两个下拉展开后是完整目录，按 简中 / 繁中 / 英文 分组、按 RN 选择器顺序排；行尾：有朗读（record-voice-over）、在线、需下载 / 下载中。
- 朗读：`ChapterAudioSource` 加 KJV（audiotreasure，RN kjv-chapter-audio-url.ts 的 stem 规则）。
- 面板里的译本名与分组名按中文界面走（界面文案目前只有中文；系统英文的手机若按 RN 规则会混出一行英文），繁体系统给繁体。
- 实测（两端模拟器）：当代译本（简体）Genesis 1 从 bible.com 抓到并按中文面排版、朗读键置灰；KJV 选中后按需下载 6MB、英文面 + audiotreasure 朗读 5:03；
  面板分组 简中 / 繁中 / 英文，行尾「在线」「需下载」「朗读」标记。
- 下载译本的落盘路径规则（Application Support/scripture/<id>.sqlite）放在 `ScriptureDatabase.installedDirectory / installedFile / isInstalled`，
  `TranslationDownloader` 只是转发——`check:scripture-data` 的 Swift harness 要能单独编译 ScriptureDatabase.swift。
- KJV 正文标点前带空格（"the earth ."）的根因在 `scripts/import-public-domain-usfx.mjs` 的 `stripXml`：eBible 带 Strong's 号的版本
  每个词都包在 `<w s="H7225">…</w>` 里、标点紧贴 `</w>`，旧脚本把所有标签替换成空格，于是词与标点分家、甚至把 "burdensome" 切成 "burden some"。
  2026-09-09 修法：字符级行内标签（w / add / nd / wj…）去掉不补空格，再做标点前后空格规范，顺手去掉 1611 版式的 ¶ 段落记号；
  `scripts/import-askbible-usfx.mjs` 同步改。受影响的 kjv / asv / dby-en / rvg-es / blm-es 已从 eBible 重导重建
  （节键与旧库完全一致，逐节比对只差空格与被切开的词）；rv1909-es 的源 XML 不在本机（`~/Desktop/APP/01 AskBible 2/data/`），没重导。
  重建脚本 `scripts/build-bible-sqlite-from-json.ts` 加了保护：本机没有 `data/scripture/reader-verse-themes.sqlite` 时沿用已提交 sqlite 的
  theme_repeat_count（金句色带），不再刷成 0。KJV 现在会带启发式的神言区间（829 节；旧库因空格 bug 一个都没推出来）。
  新 kjv.sqlite 已 `wrangler r2 object put` 覆盖到 R2；RN 线上不校验体积、也不会主动提示更新，已装旧文件的用户要重装才换新。
- 2026-09-09 修：重启恢复上次译本时 `TranslationPrefsRules.parse` 的 allowed 列表原来只给内置四本，KJV / 在线译本重启后会被打回
  同语言内置本（iOS 落到 ust-en、Android 落到 cuv-simp）。RN 传的是整个目录，两端改成 `ScriptureTranslation.all`；
  收藏页的译本名也改用 `find(id)`，非内置译本不再显示裸 id。两端实测：选 KJV → 杀进程重开 → 仍是 KJV、目录英文面。
- 没做：ESV / NLT / NKJV（要密钥）；YouVersion 音频（RN 也停了）；在线译本的全文搜索；译本更新检查（RN scripture-translation-update）。

### 读经计划播放页 = 底栏中央键的主页面（2026-09-09）

Josh：「APP 中间的读经计划，也是一个主页专页，不要变成是内页」「点中间计划与旁边的圣经，要直接就切换过来」「圣经目录面下面不需要展示读经计划」「功能上一致，内容排版上可以优化」。

- 底栏新增 `ShellTab.plan / PLAN`：中央键切到它，与首页平级、底栏照常，停在上面时中央键点亮 LOGO 黄；
  计划目录 / 详情变成计划 Tab 的内页（`planRoute: play / plans / planDetail`），仍无底栏、左上返回；目录页底部的计划区块删掉。
- `PlanPlayView.swift` / `PlanPlayScreen.kt` 照 RN ReadPlanPlayScreen 全功能：计划名 + 齿轮（→ 计划目录）；月历（黑底 = 系统今天、黄底 = 选中或听过、计划外淡显；
  ‹ › 翻月）；选今天之后的日子出「进度设置为今日」；抬头「第 N 天 · 今日读经 · i / n」；逐章列表单击点播、320ms 内再点进阅读页、行尾「阅读」「声音」
  （在播的那章换 graphic-eq）；深读计划下面列 52 阶，点选弹「设为今日读经」确认；底部复用 PlaybackDock（左键 = 经文搜索带当前章、播放键没建池时从选中章起播、下一章顺队列）。
- 逻辑层 `Model/PlanPlay.swift` / core `PlanPlay.kt`：contentAhead（RN resolvePlanPlayContentAhead）、isAheadSelectable、planDayNumber、registryDayIndex、monthGrid / describe；
  `ReadingPlanStore` 加 `readings(atContentAhead:)`（三循环永远按日历天算指针，与 RN loadReadingPlanPayloadAtAhead 一致）、`setAheadDays`（写 aheadDays 并把指针型计划跳到对应计划天，保留已读记录）、
  `setNtStageAsToday`（RN setNtDeepRepeatCurriculumStageAsToday：早于日历天挪 startedOn、晚于记 aheadDays）、`listenedDates / markListened`（点听过的日历日；读完一章的日子也标）。
  `check:reading-plan` 加 ahead 5 · aheadsel 8 · planday 6 · regidx 4 · calgrid 6，三端 99 条一致。
- 播放流：shell 多了 `listenChapter`（章页没开时的音源目标）与 `planFlowHost`（listen / chapter）——播放页点播只换音源不开章页、播完顺队列；
  从播放页进章页（阅读键 / 双击）不停播，返回回计划 Tab（`chapterFromPlan`）；目录页在播放中也出坞（RN 非章页只在播放中才出坞）。
- 计划目录的正式研读卡补了 RN 的「背景与原理见 麦克阿瑟的研经方法 →」链接（切到探索 Tab 直接开那篇文章；iOS ExploreView 的当前文章改由 shell 持有）。
- 实测（安卓模拟器）：中央键 ↔ 圣经键直接切换；选 9/12 → 列表变第 161 天、出确认键；点行播放 Psalms 119（KJV，17:46），切到圣经页再切回仍在播、高亮同步；
  阅读键进章页、返回回计划页不断音；齿轮进目录（无底栏）返回；「进度设置为今日」后 aheadDays=3、日历回到今天、听过的 12 日保留黄标。

### 音乐页各栏动画对齐 RN（2026-09-09）

Josh：「音乐页，里的各栏，上面的动画对齐一下，优化一下」。原生版之前只有一套静态鱼群漩涡，六个专辑共用；RN 每个专辑上方各有一套动画。

- 专辑 → 场景（RN MusicHomeBackdrop / MusicHomeUpperDecor）：安静 = 鱼群漩涡（100 条、9 组谐波轨道、摆尾 + 闪烁）+ 呼吸环（吸 7s · 停 · 呼 8s）；
  下午茶 = 咖啡杯 + 呼吸光晕 + 34 颗咖啡豆绕圈跳舞（首颗白豆带三颗跟随）；睡眠 = 28 颗闪烁星 + 4 颗流星（上方 34% 天空）+ 月亮（7.2s 明暗）；
  专注工作 = 核心雾 + 大球 + 两颗行星（72s / 32s 一圈）；钢琴 / 赞美诗 = 只画平铺渐变。整屏底是各专辑自己的三色渐变 + 三个呼吸光球（睡眠 / 钢琴 / 赞美诗不画球）。
- 逻辑层 `Model/MusicVisuals.swift` / core `MusicVisuals.kt`：RN 的 Animated 时钟 + interpolate 全部改成「时间 t → 当帧数值」的纯函数，
  种子（pseudoRandom01）、轨道布局（coffeeOrbitLayout / coffeeBeanNodeLayout）、星 / 流星参数逐条照抄，两端 Canvas 每帧算一遍即可；
  `check:music-visuals` 54 条三端一致（bean / orbit / prand / 专辑渐变表直接调 RN 真源，鱼 / 星 / 流星按 RN 公式在 expect 里照抄）。
- 画法：iOS `Music/MusicSceneViews.swift` = TimelineView(.animation, paused: !playing) + Canvas（鱼 / 豆 / 星 / 流星）+ SwiftUI 圆（光球 / 环 / 行星）；
  Android `ui/MusicSceneViews.kt` = withFrameMillis 时钟 + 一个 Canvas 画完（柔光用径向渐变代替 RN 的 shadowRadius）。
  只在音乐播放时走帧（RN albumDecorMotionActive），停播定格。素材：fish.png（与 RN fish-shape.png 同一张）、sleep-crescent-moon.png、coffee-bean-shape.png。
- 实测两端：六栏切换各自场景正确；安卓播放中隔 3 秒截图豆子位置变化；iOS 同。

### 会员登录 / 注册接上（2026-09-09）

Josh 真机反馈：「探索里 登录 点了，没有进入登录的」「接上用户页 / 用户登录页」。

- RN 是 Supabase 直连（supabase-js，不经 askbible.me）：`signInWithPassword` / `signUp` / `getUser` + `askbible_profiles` 表读写。
  原生用同一套 GoTrue（`/auth/v1/token?grant_type=password`、`/auth/v1/signup`、`/auth/v1/user`、`/auth/v1/logout`）与
  PostgREST（`/rest/v1/askbible_profiles`，upsert 用 `on_conflict=user_id` + `Prefer: resolution=merge-duplicates`）手写请求：
  iOS `Model/MemberAuth.swift`（URLSession async）/ core `MemberAuth.kt`（HttpURLConnection，IO 线程）。Supabase URL 与 anon key 与 RN app.config 同一套（anon key 本来就是公开发布密钥）。
- 本机会话 JSON 与 RN 同形同键（`askbible.mobile.member-session.v1`：sessionToken / expiresAt / user）；启动时后台 `getUser` 校验，401 清会话、离线保留（RN useMemberAuthBootstrap）。
  错误文案映射（邮箱或密码不正确 / 请先完成邮箱验证 / 该邮箱已注册 / network）、显示名回退（full_name → name → display_name → 邮箱）照抄 RN；`check:member-auth` 28 条三端一致。
- 页面：`Auth/AuthViews.swift`、`ui/AuthScreens.kt` = 登录 / 注册（羊皮卷底、返回、标题、引言、邮箱 / 密码 / 昵称、提交、切换链接），盖在整个壳上、无底栏（RN stack 路由）。
  探索页抬头：没登录「请登录，解锁更多」点了进登录页；登录后「你好，名字」点了改称呼（写本机 + askbible_profiles）；
  RN 的「退出登录」在侧边抽屉里，原生还没有抽屉，先放在抬头下面一行小字。
- 没做：登录后的读经进度同步（member-sync）；删除账号；侧边抽屉。（Google / Apple 第三方登录见下一节。）

### Google / Apple 第三方登录接上（2026-09-09）

Josh：「接入苹果 安卓 帐号登录」。RN 的 Google 登录有两条路：原生 SDK（只在显式配了 iosUrlScheme / androidClientId 时）与
Supabase 浏览器 OAuth（PKCE，回到 `askbible://auth/callback`）；安卓默认就是浏览器那条。Apple 走 expo-apple-authentication（系统登录）→ Supabase `signInWithIdToken`。
原生不引第三方 SDK，两端都走 Supabase 浏览器 OAuth 做 Google，iOS 再用系统 AuthenticationServices 做 Apple。

- 纯规则 `Model/MemberOAuth.swift` / core `MemberOAuth.kt`（`MemberOAuthRules`）：PKCE verifier / challenge（base64url sha256）、SHA-256 hex nonce、
  supabase-js 同款 authorize URL（含它对 code_challenge 的两次编码）、回调 URL 识别（`isGoogleOAuthCallbackUrl`）与解析（query 后 fragment 覆盖、error_code 优先）、
  `resolveMemberOAuthError` 的全部分支、Apple 姓名拼接、Supabase id_token 错误 → code。`check:member-auth` 从 28 条加到 92 条，三端一致
  （TS 侧 resolveMemberOAuthError 直接 import RN 源码，其余照抄）。
- 网络：`SupabaseAuthClient.exchangeCode`（`grant_type=pkce`：auth_code + code_verifier）、`signInWithIdToken`（`grant_type=id_token`：provider / id_token / nonce 原文）、
  `sessionFromTokens`（回调直接带 access_token 的 implicit 分支）。拿到 session 后与邮箱登录同一条 `session(from:)`：ensureProfile 落 askbible_profiles，会话 JSON 同形同键。
- iOS：`Auth/SocialSignIn.swift`。Google = `ASWebAuthenticationSession`（ephemeral，同 RN preferEphemeralSession；callbackURLScheme `askbible`，不用注册 URL scheme，
  也不会与同机的 RN 版抢链接）→ code 换会话。Apple = `ASAuthorizationAppleIDProvider`（fullName + email，nonce 传 SHA-256）→ identityToken → id_token 换会话；
  加了 `AskBible.entitlements`（`com.apple.developer.applesignin`）并在 pbxproj 两个配置里挂 `CODE_SIGN_ENTITLEMENTS`。
  模拟器没登 Apple ID 时系统弹「需要在设置中登录 Apple 账户」，关掉后行内显示「Apple 登录失败，请重试。」（RN 同款非取消失败文案）；点 Google 弹 Safari 登录页，关掉即取消不提示。
- Android：`androidx.browser` Custom Tab 打开 authorize URL；`MainActivity` 改 `singleTask` + `askbible://auth/callback` intent-filter，`onNewIntent` → `OAuthCallbackBus` →
  `MemberAuthStore.handleOAuthCallback`（在 store 自己的 scope 里换会话——挂在 LaunchedEffect 上会因回调总线清空而被取消，第一版就卡在转圈上）。
  verifier 先落 SharedPreferences，进程被杀回调回来也能换。用户关掉浏览器没回调：ON_RESUME 后 1.5 秒仍无回调就当取消。
  模拟器验证：Custom Tab 到 accounts.google.com 选帐户页；用假 code 走深链回来显示 Supabase 的 `invalid flow state, no valid flow state found`（RN 也是原样显示），按钮恢复。
  没帮 Josh 选他的 Google 帐户（那是他的帐号操作），真登一次要他自己点。
- 页面：登录 / 注册页顶部「使用 Google 继续」「使用 Apple 继续」（iOS 才有 Apple，RN 安卓也不显示）→ 行内红字错误 → 「或」分隔 → 邮箱表单；
  按钮 48 高 / 圆角 12 / hairline 边 / fillStrong 底 / 左 20 槽品牌标 + 右侧对称留槽，照 RN OAuthProviderButton。Google 四色 G 用 RN 的 SVG path：
  Compose 直接 `PathParser`，Swift 写了个只认 M/L/H/V/C/S/Z 的小解析器；Apple 标用系统 `apple.logo`。
- 要 Josh 在 Supabase 后台做的：Apple 提供商的 Client IDs 里加原生包名 `me.askbible.native`（RN 是 `me.askbible`），否则 Apple 登录会报 audience 不接受 →
  行内提示「Apple 登录尚未配置…」。上真机的 Sign in with Apple 还要在开发者后台给 `me.askbible.native` 这个 App ID 开 Sign in with Apple 能力（模拟器不用）。
  Google 那条不需要新配置（redirect `askbible://auth/callback` RN 已在白名单里）。
- 已知：手机上同时装着 RN 版和原生版时，`askbible://auth/callback` 两个 App 都认领，安卓回调会弹「用哪个应用打开」，选「AskBible 原生」即可
  （模拟器上两版都在；iOS 由 ASWebAuthenticationSession 自己截回调，没这个问题）。
- `check:tokens` 加了「登记在案的故意偏离」表（`KNOWN_DEVIATIONS`）：播放坞 `playIconNudge` 原生归 0、RN 仍 3 的事在表里点名，等于登记值才算过。

### 真机反馈修的三处（2026-09-09，三星 S23 Ultra）

- 章页播放坞：开章预载会短暂 BUFFERING，之前播放键一直转圈（RN 开章不转）→ 两端只在用户点了播放（`wantsPlayback`）还没出声时才转圈；计划播放页的行按钮同理。
- 播放三角「偏了」：RN playIconNudge 3 加上字形本身框中心偏右约 2，真机上明显偏 → 两端 nudge 改 0。
- 右侧 + − 没有投影 → 安卓 RailLabel / ChromeLabel 加 ShellIconShadow（iOS 本来就有）。
- 收藏底色「四角要加弧边」：RN 圆角 2 真机上看还是方的 → 两端逐行圆角改 6。

### Phase 4 — 其余屏幕（10–18 个月）
`music` 15.9k → `home` 12.5k → `explore` 11.8k → 其余。逐屏发版，风险分散。

### Phase 5 — 翻转导航壳（4–8 周）
`expo-router` 93 个触点换成 SwiftUI NavigationStack / Compose Navigation。
摘除 RN、Metro、25 个 expo-* 包、4 个 postinstall patch 脚本。
**必须最后做** —— 在此之前 RN 壳是唯一的安全网。

**总量估计：单人 20–32 个月**（纯双写；若采用共享逻辑层约为 12–20 个月，Josh 已明确排除）。

---

## 五、风险闸门

- **Phase 3 是唯一真正的赌点**。此前投入均可保值，此后不可逆。
- 每阶段结束必须可发版。
- 三端规则漂移是最隐蔽的长期伤害 —— Phase 0 的防护是硬要求，不可跳过。
- 重写期间产品迭代速度显著下降，属已知代价。

## 六、相关文档
- `docs/11-module-boundaries.md` — 模块边界
- `docs/mobile-feature-map.md` — 功能地图（重写时的对照清单）
- `docs/mobile-release-checklist.md` — 发版流程（每阶段沿用）
- `apps/askbible-mobile/ARCHITECTURE.md` — 现有架构
