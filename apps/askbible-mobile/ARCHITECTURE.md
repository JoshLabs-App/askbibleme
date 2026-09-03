# apps/askbible-mobile 代码架构地图

> 本文是**代码地图**，不是产品哲学文档。产品边界 / 语气 / 工作方式见根目录 `AGENTS.md` 与 `docs/AI_HANDOFF.md`，改代码前仍应先读那两份。这里只回答一个问题：**改某个功能该先看哪些文件、模块之间怎么连**。
>
> 阅读时间目标：5–10 分钟。内容基于抽样阅读源码得出；标了「未验证」的地方是我没有逐行确认，改动前自行确认。

---

## 1. 顶层结构

```
apps/askbible-mobile/
├── app/            # Expo Router 路由（文件即路由，只做「装配」，不写业务逻辑）
├── src/            # 实际业务代码，按领域分目录
├── android/ ios/    # 原生工程（含自定义原生模块，如 ShellMediaControls）
└── assets/          # 打包内静态资源（图标、部分音频等）
```

`app/` 里的每个文件通常很薄：导入 `src/` 里的一个 Screen 组件，加 `<Stack.Screen>` 配置，仅此而已。**业务逻辑永远在 `src/` 里找，不在 `app/` 里找。**

---

## 2. `src/` 各目录职责一览

| 目录 | 职责 | 代表文件 |
|---|---|---|
| `read/` | 读经主战场：目录/翻页/章节页/朗读设置/计划播放桥接。文件数量最多，命名前缀 `Read*` / `BibleCatalog*`。 | `ReadChapterScreen.tsx`、`ReadCatalogScreen.tsx`、`PlanFlowPlaybackBridge.tsx` |
| `home/` | 首页「安静」自然背景 + 金句轮播 + 金句语音播放。含 iOS/Android 分平台的全屏视频组件（`.ios.tsx`/`.android.tsx`）。 | `HomeNatureScreen.tsx`、`useHomeNatureVerseAudioPlayback.ts` |
| `explore/` | 「探索」Tab：文章、历史信条、年岁电池、生日设置等辅助功能页面集合。 | `ExploreScreen.tsx`、`ExploreHistoricalCreedsScreen.tsx` |
| `audio/` | **音频/媒体会话的核心协调层**（非某一具体播放器），管理「谁在播、系统媒体控件同步、iOS/Android 音频会话规则」。详见第 3 节。 | `shellMediaControls.ts`、`useShellMediaControlsSync.ts`、`shellAudioMode.ts` |
| `music/` | 音乐 Tab 的 UI 与播放上下文（`MusicPlaybackContext` 未直接读到但被 `app/_layout.tsx` 引用）、专辑视觉效果、音轨播放辅助函数。 | `MusicHomeScreen.tsx`、`musicTrackPlayback.ts`（按文件名推断）、`scriptureUserPause.ts` |
| `nature/` | 首页背景「环境音」（雨声/海浪等）的播放与场景选择逻辑，与 `home/` 的金句语音是两套独立音轨。 | `useNatureAmbientMix.ts`、`resolveNaturePlayback.ts`、`natureAmbientExclusiveStop.ts` |
| `bible/` | 圣经内容相关的纯逻辑：章节音频源解析、经文分段、直接引语（神的话）高亮检测、经文剪贴板格式化。不含 UI。 | `chapter-audio-sources.ts`、`divineSpeechCueDetection.ts`、`cuv-chapter-audio.ts` |
| `api/` | 对外网络请求封装：会员登录注册、翻译目录、内容清单拉取。 | `memberAuth*.ts`、`fetchBibleTranslationsCatalog.ts`、`mobileContentManifest.ts` |
| `auth/` | 登录/注册 UI + 会员会话管理 + OAuth（Apple / Google 各自的多个环节：native / deep link / exchange / session）。 | `MemberAuthProvider.tsx`、`googleOAuth*.ts`、`appleSignIn*.ts` |
| `member-sync/` | 已登录用户的阅读进度/计划跨设备同步。详见第 4 节。 | `runMemberReadingSync.ts`、`useMemberReadingSync.ts`、`mergeReadingBlobs.ts` |
| `navigation/` | 路由参数解析的小工具，体量很小。 | `resolveRouteParam.ts` |
| `notifications/` | 推送权限、本地通知调度、「读经闹钟」（过夜提醒 + 唤醒播放）全套逻辑，含 Android 精确闹钟/电池优化权限处理。 | `localNotificationScheduler.ts`、`readingAlarmWake.ts`、`readingAlarmAndroidPermissions.ts` |
| `onboarding/` | 首次启动引导（欢迎页、devotion intro、登录面板）与「是否已完成引导」的判定/持久化。 | `OnboardingWelcomeLoginPanel.tsx`、`onboarding-devotion-gate.ts`、`welcome-routes.ts` |
| `i18n/` | 语言环境 Provider、简繁转换映射表、站点文案集中管理。 | `LocaleProvider.tsx`、`site-copy.ts`、`site-copy-zh-tw-*.ts` |
| `shell/` | App 外壳：底部 Tab 栏、左侧抽屉导航、启动闪屏、版本号角标、滑动手势导航容器、错误边界。 | `ShellTabBar.tsx`、`ShellNavDrawer.tsx`、`ShellSwipeNavView.tsx`、`ShellErrorBoundary.tsx` |
| `ui/` | 与业务无关的通用 UI 小组件（边缘渐隐滚动视图、进度条）。 | `EdgeFadeScrollView.tsx`、`MinimalProgressBar.tsx` |
| `components/` | 目前只有一个占位组件，体量很小，未形成通用组件库。 | `PlaceholderScreen.tsx` |
| `config/` | 环境相关的基址/开关：站点 base URL、Google/Supabase 鉴权配置、「仅本地打包资源」开关。 | `askbibleBaseUrl.ts`、`mobileBundledOnly.ts` |
| `telemetry/` | 埋点上报与用户同意（consent）管理。 | `TelemetryProvider.tsx`、`consent.ts`、`tap.ts` |
| `widget/` | iOS/Android 桌面小组件（今日金句）的数据快照生成、深链跳转、冷启动播放请求桥接。 | `buildDailyVerseWidgetSnapshot.ts`、`widgetPlaybackRequest.ts`、`WidgetPlaybackDeepLinkBridge.tsx` |
| `media/` | 音乐/环境音的**资源就绪状态**管理：本地打包 vs Android Asset Pack vs R2 远程流式缓存 vs 旧 resource-pack 的多级回退。 | `bundledMusicMedia.ts`、`androidMusicAssetPack.ts`、`musicR2StreamCache.ts` |

其余小目录（`content-correction/`、`debug/`、`feedback/`、`fonts/`、`legacy-figures/`、`network/`、`relax/`、`scenes/`、`theme.ts`、`types/`、`updates/`）体量小或用途从名字即可判断，未逐一展开，改动前建议先 `ls` 确认现状。

---

## 3. 音频/媒体播放状态如何流动

这是本仓库最复杂的一块，核心问题是：**首页金句语音、音乐、读经朗读、环境音这四条音轨要共享同一套系统媒体控件（锁屏/通知栏），还要应对 iOS/Android 完全不同的后台音频规则**，因此拆成了「谁在播的意图（want-playing）」「实际同步到系统的会话」两层。

### 3.1 关键文件与分工

- **`audio/shellMusicWantPlaying.ts` / `shellVerseWantPlaying.ts` / `shellScriptureWantPlaying.ts`**：三个独立的「用户是否希望这条音轨在播」状态源（音乐 / 首页金句 / 读经朗读），互相解耦，供各处订阅。
- **`audio/shellAuxMediaOwner.ts`**：记录当前「辅助音频」（如金句）的所有者标识，避免多个金句实例互相打架。`home/useHomeNatureVerseAudioPlayback.ts` 用固定 ID `"home-golden-verse"` 占用这个所有者位。
- **`audio/shellAudioMode.ts`**：根据场景（普通 vs 读经/金句 scripture 模式）切换 `expo-av` 的全局 AudioMode（如是否允许后台播放、是否 duck 系统其它音）。
- **`audio/shellMediaControls.ts`**：与**原生模块** `AskBibleShellMediaControls`（iOS/Android 各自实现，通过 Expo Modules / TurboModule 注册）通信的桥。职责：
  - `syncShellMediaSession` / `syncShellMediaSessionExplicit`：把当前播放状态（标题、进度、封面、下一首 URI 等）`updateSession(json)` 推给原生，驱动锁屏/通知栏控件；
  - `pauseShellAppMusic` / `resumeAppMusic`：响应系统栏按钮；
  - 记录 `shellMediaSessionUserDismissed`：用户划掉系统媒体通知后，短期内不再自动推送新会话（避免通知“打不死”）。
- **`audio/useShellMediaControlsSync.ts`**：一个大 Hook，把音乐/读经的实际播放状态（`playing`、进度、曲目）与三个 want-playing 状态、桌面小组件快照（`widget/readingAudioWidget.ts`）粘合在一起，并处理「App 进入后台后是否还要继续给原生媒体会话打心跳」的平台差异（见 `shouldSkipNativeBackgroundSessionTick`）。
- **`home/useHomeNatureVerseAudioPlayback.ts`**：首页金句语音播放器本体，用 `expo-av` 播放金句音频（本地打包优先，其次 R2 直链，见 `resolveGoldenVerseAudioUrl`），播完自动进入「句间静音（gap）」再切下一句。它不直接碰原生播放器，而是通过上面几个 want-playing / owner / media-controls 模块与音乐、读经协调「谁能出声」。
- **`nature/useNatureAmbientMix.ts`**：环境音（雨声等）是第四条独立音轨，走 `expo-av`，不占用「原生主轨（音乐/读经）」，但仍需遵守系统栏暂停/续播（见 `nature/natureAmbientExclusiveStop.ts`）。

### 3.2 已记录的平台坑点（原文注释摘录）

- `apps/askbible-mobile/src/home/useHomeNatureVerseAudioPlayback.ts:60` — iOS 音乐在播时不能切到 scripture AudioMode，否则会打断原生音乐；金句需要叠加在同一 playback 会话上。
- `apps/askbible-mobile/src/home/useHomeNatureVerseAudioPlayback.ts:68` — 安卓锁屏/关屏后 JS 容易被系统冻结；给原生播放队列要一次喂够多条，不能只喂一条等 JS 醒来再补。
- `apps/askbible-mobile/src/audio/iosMusicBackgroundQuarantine.ts:36-38` — iOS 音乐在锁屏播放时要卸掉导航/视频重层；但金句 Hook 挂在 Home 页面上，卸导航会连带把金句播放器也停掉，所以金句场景**不**执行这个卸载。
- `apps/askbible-mobile/src/audio/scriptureAudioPlayback.ts:26` — 整章朗读优先用 `require()` 打包模块加载音频，因为 Android 上 `Asset.uri` 有些资源无法直接播放。
- `apps/askbible-mobile/src/audio/shellAudioMode.ts:92` — Android 端：`http(s)` 走远程流式播放，`file://` 直连播放，其余类型的 asset URI 需要先落盘再播。
- `apps/askbible-mobile/src/audio/shellMusicPlayableAssetUri.ts:34,43` — iOS 原生 AVPlayer 只接受本地 `file` URI，拒绝 Metro 开发服务器的 `http` 地址（会跳过或空转无声）；线上允许的例外是打了标记的临时 HTTPS（R2）。
- `apps/askbible-mobile/src/media/natureSceneReadiness.ts:10,25,36` — Android `expo-video` 要用 `file / content / android.resource` 协议的 URI，不能用 `Asset.fromModule` 给出的虚拟路径；`android.resource://` 是唯一能播原生 raw 资源的写法。
- `apps/askbible-mobile/src/nature/useNatureAmbientMix.ts:48` — 安卓 ExoPlayer 对无 scheme 的 raw 资源名要走 `RawResourceDataSource`，不能用 `file:///android_res` 这种路径。
- `apps/askbible-mobile/src/notifications/readingAlarmAndroidPermissions.ts:61-65` — Android 过夜提醒要准时送达，需要「精确闹钟」+「电池优化豁免」两项权限，一次只提示一项。

---

## 4. 阅读计划同步（member-sync）如何工作

**高层流程**（`member-sync/runMemberReadingSync.ts`，约 560 行，核心协调函数，未逐行读完，以下为骨架级描述）：

1. `auth/memberSession.ts` 提供当前会员会话（token）；只有登录用户（`auth/MemberAuthProvider.tsx` 里 `bootstrapped && user` 为真）才会触发同步，见 `member-sync/MemberReadingSyncBridge.tsx`（挂在 `app/_layout.tsx` 里，是个「无 UI 副作用组件」）。
2. 本地阅读进度/收藏/计划偏好等以多个「blob」形式存在本地（`readingSyncLocal.ts` 导出 / 导入），例如 `readingPlanPrefs`、`appLocale` 等 key。
3. 同步分「推」（`pushMemberReadingSync*`）和「拉」（`pullMemberReadingSync*`），且**有两套后端路径**：Supabase 直连（`*ToSupabase` / `*FromSupabase`）和站点 API（`memberReadingSyncApi.ts` 里不带 Supabase 后缀的函数）——代码里两者都尝试，Supabase 优先，失败则退回站点 API。
4. 合并逻辑在 `mergeReadingBlobs.ts`（`mergeMemberReadingSyncPush`），按「远端 + 本地推送 + 最新本地」三次合并，避免网络往返期间本地又发生变化导致旧快照覆盖新数据。
5. `member-sync/memberReadingSyncOwnerPolicy.ts` 决定本次同步走「继续本机数据」「用远端替换本机」「pull-only（重装/换账号/本机为空）」中的哪一条路径——这是防止「换设备/换账号时本地脏数据污染云端」的关键策略层，改同步逻辑前必须先读这个文件。
6. 有一个专门函数 `confirmRemoteReadingPlan`：切换阅读计划后会主动回读远端确认写入生效，不生效则重试推送，最多重试 3 次（每次间隔 400ms）——说明这里历史上大概率踩过「写入未落地」的坑。
7. 与 `read/` 的关系：`read/reading-plan/reading-plan-prefs.ts` 是本地计划偏好的读写真源，`member-sync` 只是把它序列化成 blob 上传/下载，不直接管理计划的业务规则。

---

## 5. 路由结构（Expo Router）

```
app/
├── _layout.tsx              # 根布局：挂载所有 Provider/Bridge（Auth、Locale、Telemetry、
│                             #   MemberReadingSyncBridge、NotificationSetupBridge、
│                             #   ReadingAlarmBridge、PlanFlowPlaybackBridge 等），装配 Tab 外壳
├── (tabs)/
│   ├── _layout.tsx           # 四个底部 Tab 的布局（Home / Music / Read / Explore）
│   ├── index.tsx             # Home Tab → src/home/HomeNatureScreen.tsx
│   ├── music.tsx              # Music Tab → src/music/MusicHomeScreen.tsx（推断）
│   ├── explore/               # Explore Tab，含子路由
│   ├── read/                  # Read Tab，含 catalog / favorites / plan-play / search / translations 子路由
│   └── journey.tsx            # 计划听读入口（对应 AGENTS.md 里说的「中间 FAB，非 Tab」）
├── login.tsx / register.tsx   # 登录注册（→ src/auth/）
├── welcome.tsx                # 引导欢迎页（→ src/onboarding/）
├── feedback.tsx / relax.tsx / scenes.tsx
├── dev/                       # 仅开发态自测页面（Maestro/OAuth/计划流程 E2E），不面向用户
└── +native-intent.ts, +not-found.tsx
```

规律：`app/**` 文件名/路径决定 URL 结构，文件体内容几乎总是「引入 `src/` 里的 Screen + 包一层 `<Stack.Screen>`」。**要改页面业务逻辑，去 `src/` 对应目录找同名 Screen 组件**，`app/` 目录基本不用碰。

---

## 6. 已知坑点 / 踩坑记录（代码注释汇总）

见第 3.2 节完整列表（音频/媒体相关）。额外两条非音频类：

- `apps/askbible-mobile/src/audio/androidRemotePlaybackMute.ts:105,131` — Android 系统栏暂停需要停掉 App 当前所有在播的声音源（音乐/金句/读经/环境音），再点播放要「按暂停前的组合」恢复，不能简单粗暴地只恢复一路。
- `apps/askbible-mobile/src/media/bundledMusicMedia.ts:28` — 音乐资源解析有 6 级回退链：安装包 → Android Asset Pack → R2 本地缓存 → 旧 resource-pack → R2 HTTPS（临时方案）→ 线上流式（仅非 bundled-only 模式）。改音乐资源加载前务必确认当前回退链没有被绕过。
- 真机装「独立版」（无 DEV 横幅、不走 TestFlight）不能直接用 Release 配置装机（Apple 禁止 App Store 描述文件直装）；也不用折腾 EAS ad-hoc（这个项目里从没配成功过）。做法和已知的 Expo CLI devicectl 卡死坑点见 `docs/AI_HANDOFF.md` 「真机装独立版」一节。

如果你在读代码时发现新的平台专属注释（含「iOS」「Android」「安卓」「苹果」字样且解释了「为什么这样写」），建议随手补进本节，保持这份坑点清单跟代码同步。

---

## 7. 如何找到某个功能（快速对照表）

| 想做的事 | 先看这些文件/目录 |
|---|---|
| 改音频播放逻辑（金句/音乐/读经/环境音谁能出声、锁屏控件） | `src/audio/`（尤其 `shellMediaControls.ts`、`useShellMediaControlsSync.ts`、三个 `*WantPlaying.ts`）、`src/home/useHomeNatureVerseAudioPlayback.ts`（首页金句）、`src/nature/useNatureAmbientMix.ts`（环境音）、`src/music/`（音乐 UI/播放） |
| 改阅读计划 / 计划同步 | `src/read/reading-plan/`（本地计划规则）、`src/member-sync/`（跨设备同步，尤其 `runMemberReadingSync.ts` 和 `memberReadingSyncOwnerPolicy.ts`） |
| 改登录 / 账号 / OAuth | `src/auth/`（`MemberAuthProvider.tsx` 是入口）、`src/api/memberAuth*.ts`（网络层）、`src/config/googleAuth.ts` / `supabaseAuth.ts` |
| 改读经页面 UI（章节页/目录/朗读设置） | `src/read/`（`ReadChapterScreen.tsx` 是章节页主体，`ReadCatalogScreen.tsx` 是目录） |
| 改首页背景/金句轮播 UI | `src/home/`（`HomeNatureScreen.tsx` 及其 `HomeNatureScreen*` 系列子组件） |
| 改音乐播放界面 | `src/music/`（`MusicHomeScreen.tsx` 及一系列 `MusicHome*` 视觉子组件） |
| 改推送通知 / 过夜读经闹钟 | `src/notifications/`（`readingAlarm*.ts` 系列是闹钟专属逻辑，其它是普通推送） |
| 改底部 Tab / 抽屉导航 / App 外壳 | `src/shell/`（`ShellTabBar.tsx`、`ShellNavDrawer.tsx`） |
| 改语言/多语言文案 | `src/i18n/`（`site-copy.ts` 是主文案表，`site-copy-zh-tw-*.ts` 是繁体转换） |
| 改桌面小组件（今日金句 widget） | `src/widget/` |
| 改音乐/环境音的资源打包与下载策略 | `src/media/`（`bundledMusicMedia.ts`、`androidMusicAssetPack.ts`、`musicR2StreamCache.ts`） |
| 改路由结构 / 新增页面 | `app/`（先在这里加路由文件），业务逻辑仍写在 `src/` 对应目录，`app/` 里只做装配 |
| 改埋点 / 用户数据合规 | `src/telemetry/` |
| 改首次启动引导流程 | `src/onboarding/` |

---

## 8. 未验证 / 建议后续确认的点

- `music/MusicPlaybackContext.tsx` 被 `app/_layout.tsx` 引用，但本次未展开读其内部实现，音乐播放状态的最终真源建议改动前单独确认。
- `shellMediaControls.ts` 对应的原生模块 `AskBibleShellMediaControls` 具体实现在 `android/` 和 `ios/` 原生工程里，本文未深入原生代码，只梳理了 JS 侧调用面。
- 本文档基于 2026-08-31 代码抽样阅读整理，`src/` 目录会持续变化，发现与代码不符时以代码为准并欢迎修正本文件。
