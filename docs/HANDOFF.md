# AskBible.me — AI 交接开发文档

**用途**：其它 AI / Agent 接手本仓库时的**唯一启动入口**。先读本文，再按需下钻；不要通读全库。  
**日期**：2026-08-27  
**仓库**：`/Users/joshua/Desktop/APP/01AskBible`  
**显示名**：AskBible.me（域名 `askbible.me`）。内部名 `selah-*`、包名 `me.askbible` **不得**出现在用户界面。

---

## 0. 启动顺序（强制）

按顺序读，读完再改代码：

| 步 | 文件 | 用途 |
|----|------|------|
| 1 | 本文 `docs/HANDOFF.md` | 边界、地图、命令、当前状态 |
| 2 | `AGENTS.md`（仓库根） | 产品哲学与工作方式真源 |
| 3 | `/Users/joshua/Desktop/APP/skills/joshlabs-dev/SKILL.md` | 通用开发流程（最小闭环、不擅自扩功能） |
| 4 | `.cursor/rules/*.mdc` | 领域硬规则（按任务只读相关条） |
| 5 | 任务相关文档（见下文索引） | 进屏 / 媒体 / OAuth / 发版 / parking lot |

任务点名 AskBible 时，人类记忆卡（可选）：`/Users/joshua/Documents/Cursor-Memory/项目/01AskBible.md`。

用户说 **`DD`** = 在质疑后继续执行。

---

## 1. 产品是什么 / 不是什么

**是**：让人**重新进入圣经的安静入口**（羊皮卷气质、低认知负荷）。

**不是**：

- Bible Tool / 资料库百科（**人物馆例外**：`data/figures/` = 经文分类索引 + 短说明）
- AI Bible Chatbot
- 游戏化圣经 / Dashboard / 内容平台 / SaaS

危险方向真源：`docs/09-dangerous-directions.md`。  
超出范围的想法只写 `docs/10-parking-lot.md`，**不要**写进代码。

### Studio vs App（现实对齐）

| 层 | 定位 | 路径 |
|----|------|------|
| **Studio** | 产品大脑（策展/编辑部）：理清意图、防失忆、写回 `docs/`；**不是** CMS / 运营后台 | Web：`/studio`（本机） |
| **Mobile App** | 已上架、持续维护的用户端（Expo）；当前商店约 **1.0.38**（build 119） | `apps/askbible-mobile` |
| **Web 站点** | Next.js；生产在 **Vercel**（2026-10-01 实测 `askbible.me` 响应头 `server: Vercel`；Render 已停用，`www` 只剩一条 301 回根域） | `app/`、`components/`、`lib/` |

`AGENTS.md` 写「不要先做 Journey/CMS」= **不要新开产品线堆功能**；不是禁止修现有 App bug / 发版 / 对齐 iOS。

默认实现基线：**App 优化优先** → 平台顺序 **iOS → Android → Web**。

---

## 2. 硬禁令（违反即错）

1. **不擅自扩功能**；与边界冲突先短质疑 + 更紧方案，等确认（或 `DD`）。
2. **移动端禁止 EAS 云端构建**；iOS 本机 Xcode，Android 本机 Gradle。见 `docs/mobile-release-checklist.md`、`.cursor/rules/mobile-local-build-only.mdc`。
3. **媒体**：播放默认本地；大体积增量 **禁止** 走主站（Vercel）/ `askbible.me`。  
   - 音乐：安装包每专辑**第一首**；其余 TEMPORARY = **Cloudflare R2** + 本机缓存。  
   - 金句语音：TEMPORARY = **R2 直链**（勿回落 askbible.me）。  
   - **禁止**为上架开 `MOBILE_ANDROID_MUSIC_PAD=1`（会打出约 650MB AAB；正常约 160MB）。  
   真源：`.cursor/rules/mobile-local-media-playback-first.mdc`、`docs/mobile-golden-verse-audio.md`。
4. **外站拉取音频等**：禁止压缩/转码/降码率；原样直存。`.cursor/rules/no-compression-on-remote-fetch.mdc`。
5. **OAuth**：从 App 发起的登录默认回调回 App；勿盲目改成网页 HTTPS 回调。验收：`.cursor/skills/验收-OAuth/SKILL.md`。
6. **未要求不 commit / 不 push / 不发版**。Push `main` 会触发 Vercel 自动部署 + CI。
7. **禁止无门禁直推 main**；合入走 PR + `auto-merge` 标签。见 `docs/mobile-maestro-auto-merge.md`。
8. UI：安静羊皮卷气质；不擅自加装饰/动画/工业风系统默认壳。

---

## 3. 仓库地图

```
01AskBible/
├── AGENTS.md                 # 产品边界真源
├── docs/                     # 产品文档 + 本交接文 + 移动端运维
│   ├── HANDOFF.md         # ← 你在这里
│   ├── 01–11-*.md            # 愿景 / 原则 / MVP / 危险方向 / parking lot / 模块边界
│   ├── mobile-feature-map.md # App 进屏路径（验收必读）
│   ├── mobile-*.md           # 发版 / Maestro / 媒体 / 构建产物
│   └── overnight-optimization-2026-08-27.md  # 最近一夜审查与 backlog
├── .cursor/rules/            # Agent 硬规则（mdc）
├── .cursor/skills/           # 验收-UI / 验收-OAuth / 验收-媒体
├── apps/askbible-mobile/     # Expo App（主战场）
│   ├── app/                  # 路由（四 Tab：Home / Music / Read / Explore）
│   └── src/                  # auth / read / music / explore / shell / home / …
├── app/                      # Next.js App Router（站点 + API + Studio）
├── components/ lib/ hooks/   # Web 与共享逻辑
├── data/                     # 本地真源数据（圣经、计划、人物、admin 配置等）
├── scripts/                  # 同步 / 发版 / 音频 / info-edition / Maestro
├── .maestro/                 # 移动端冒烟 flow
├── store/ios-release-notes/  # 商店 What's New（en.txt / zh.txt）
├── AA/                       # 本机密钥目录（勿提交密钥内容到聊天）
└── supabase/                 # 可选云端；默认仍本地数据优先
```

模块边界草图：`docs/11-module-boundaries.md`。  
进屏路径：`docs/mobile-feature-map.md`。

壳层：**底栏四 Tab** = Home · Music · Read · Explore；**中间 FAB** = 计划听读（非 Tab）；**左上汉堡** = 抽屉。

---

## 4. 技术栈与环境

| 层 | 选型 |
|----|------|
| Web / Studio | Next.js App Router + TypeScript + Tailwind |
| Mobile | Expo / React Native（`apps/askbible-mobile`） |
| 数据 | 本地优先：`data/` + sqlite；`DATA_ROOT` 持久盘是 Render 时代的做法，Vercel 上没有持久盘，以代码为准 |
| 部署 | Vercel（推 `main` 自动部署）。Render Web Service + Persistent Disk 是旧方案，已停用 |
| 媒体增量 | Cloudflare R2（金句语音、非首曲音乐） |

### 常用命令

```bash
# Web
npm run dev              # http://localhost:3450（Turbopack）
npm run dev:fresh        # 清 .next 后起
npm run check            # tsc + build

# Mobile 开发
npm run mobile:sync-content
npm run mobile:ios
npm run mobile:android   # 视 package.json 实际 script

# 验收
npm run mobile:maestro:smoke
npm run mobile:release:preflight

# 发版（仅用户明确要求时）
npm run mobile:bump:store-version -- <marketing> <build>
# 或仅升 build：npm run mobile:bump:store-version -- --next-build
npm run mobile:release:ios:testflight
npm run mobile:submit:ios:review
npm run mobile:release:ios:appstore          # 构建+上传+提审一条龙
npm run mobile:release:android:internal      # 视 checklist

# 合入
# 开 PR 后：npm run pr:auto-merge   # 打 auto-merge 标签，CI 绿后 squash
```

Android 发版后检查：`ls -lh dist/mobile/askbible-android-latest.aab`（异常偏大先停）。

### 真机装"独立版"（无 DEV 横幅、脱离 Metro，但不走 TestFlight）

场景：想在自己手机上装一个看起来像正式版的包（`DevBuildStamp.tsx` 不显示 DEV 横幅、`__DEV__=false`、JS 提前打包内嵌不依赖 Metro），但走 App Store/TestFlight 太慢，只想直接无线装到已经用过的测试机上。

关键认知（第一次做这件事时容易想错）：
- `ios/AskBibleme.xcodeproj/project.pbxproj` 里 Release 配置签的是 **App Store** 描述文件（`... AppStore ...`），Apple 规定这类包**不能**直接装机，只能走 TestFlight——这是真限制，不是哪一步没配对。
- 但 Debug/Release（决定要不要内嵌 JS、`__DEV__` 是否为 true）和「签名用哪个描述文件」（决定能不能直接装机）是两件正交的事。已经在目标设备上装过 Debug 包（Development 描述文件）的话，那个 Development 描述文件同样可以签 Release 配置的编译产物——不需要另外去搞 Ad Hoc 描述文件或 EAS 云构建。
- 项目里 EAS 的 `preview`（ad-hoc）profile **从没有成功构建过**（`eas build --profile preview` 会因为 widget target 缺 Ad Hoc 描述文件、非交互模式下无法对 Apple 开发者门户鉴权而失败），不要默认往这条路走，除非用户愿意手动跑一次交互式 `eas build --profile preview` 把描述文件建出来。

步骤（做完务必执行第4步还原，否则会污染真正的 App Store 归档配置）：

1. 临时编辑 `project.pbxproj`：把 **两个** target（`AskBibleme` 主 App 和 `AskBibleDailyVerse` 小组件）的 Release 配置块里
   - `CODE_SIGN_IDENTITY[sdk=iphoneos*]`: `Apple Distribution` → `Apple Development`
   - `PROVISIONING_PROFILE_SPECIFIER`: `AskBible me.askbible AppStore ...` / `AskBible me.askbible.widget AppStore ...` → 改成同名的 `... Development ...`（文件里 Debug 配置块已经有现成的 Development 描述文件全名，直接照抄字符串即可，两个 target 的名字不一样别抄错）。
2. `cd apps/askbible-mobile && npx expo run:ios --device <设备名> --configuration Release --no-bundler`
   - ⚠️ **已知坑**：编译、签名、Build Succeeded 都会顺利跑完，但最后"无线装到设备"这一步，Expo CLI 自带的 devicectl 包装器有概率**卡死不动**（命令一开始如果打过 `Unexpected devicectl JSON version output from devicectl` 这行警告，基本就是要卡的前兆）。判断是不是真卡住：`ps aux | grep "devicectl device install"`，看那个子进程的 CPU 时间隔几分钟是否纹丝不动——不动就是卡住了，不用等，直接 `kill -9` 那个 node 进程（`expo run:ios ...`）和它的 devicectl 子进程，App 已经编译好躺在 DerivedData 里了，去做第3步。
3. 手动收尾装机+启动（第2步卡住时用这个；不卡住的话这步也会自动做，可以不管）：
   ```bash
   xcrun devicectl device install app --device <设备名> \
     ~/Library/Developer/Xcode/DerivedData/AskBibleme-*/Build/Products/Release-iphoneos/AskBibleme.app
   xcrun devicectl device process launch --device <设备名> me.askbible
   ```
4. **还原签名**：`git checkout -- ios/AskBibleme.xcodeproj/project.pbxproj`（前提是改之前这个文件是干净的，正常情况下都是）。
5. 查已注册测试设备名/UDID：`xcrun xctrace list devices`（真机名字，比如 `home`）或 `xcrun devicectl list devices`（看是否 `available (paired)`）。这些设备已经在 Apple Developer 账号里注册过（`eas device:list --apple-team-id AJ2998VZH6 --non-interactive` 能查到），不需要重新注册。

### 环境变量

- 模板：仓库根 `.env.example`；移动端另见 `apps/askbible-mobile/env.device.example`。
- 生产相关：`DATA_ROOT`、R2 基址 `EXPO_PUBLIC_GOLDEN_VERSE_AUDIO_BASE_URL` / `EXPO_PUBLIC_MUSIC_AUDIO_BASE_URL`、ASC / Play 密钥路径等。
- **不要**把密钥写进文档或提交到 Git；本机常在 `AA/`、`.env`（已 gitignore）。

---

## 5. 改代码后的验收（Agent 自动）

| 改了什么 | 做什么 |
|----------|--------|
| `apps/askbible-mobile` UI / 壳 / 路由 | 读 Feature Map → `npm run mobile:maestro:smoke`（模拟器已 boot 且已装包；不能跑则说明原因） |
| OAuth | `.cursor/skills/验收-OAuth/SKILL.md` |
| 音乐 / 金句 / 视频 / R2 | `.cursor/skills/验收-媒体/SKILL.md` |
| 仅纯逻辑且用户不要合 main | 可跳过 Maestro，回复里一句说明 |
| 要合 main | PR → `npm run pr:auto-merge`；禁止直推 main |

Maestro 真源：`docs/mobile-maestro-auto-merge.md`。GitHub Linux CI **不跑** Maestro（需本机模拟器）。

---

## 6. 当前状态（2026-09-14）

### 已交付 / 基线

- **原生 iOS App（Swift）`apps/askbible-ios`** 已上架提审：
  - 版本 **1.1**，build **128**，bundle ID `me.askbible`（接替 Expo App）
  - 新增 WidgetKit DailyVerse 小组件（`me.askbible.DailyVerse`），读 App Group `group.me.askbible.native`
  - 首页 `HomeVerseController.writeToWidget()` 每次换句自动刷新小组件
  - App Review 提交时间：`2026-09-14T04:51:02Z`，状态 `WAITING_FOR_REVIEW`（等待中）
  - 提审用 ASC API：`PATCH /v1/reviewSubmissions/{id}` + `attributes: { submitted: true }`（文档未记载的隐藏字段）
- **原生 Android App（Kotlin）`apps/askbible-android`** 已交付并安装到 Samsung S23 Ultra（R5CW11DNS2K）：
  - 2026-09-14 commit `43936fcd`：划重点 dispatch 改同步直发（`MutableMap<Int,(Offset)->Unit>`），消除异步 snapshotFlow 的一帧延迟；修节号处的高亮空洞（`runStart==0` 时从 `verseStart` 取，不漏节号行）
  - 2026-09-14 commit `001660b5`：人物 slug 重命名（jacob-patriarch / figure-esau / figure-leah / figure-rachel / joseph-genesis）；读经计划起始文案（tripleStartToday / tripleStartCalendar / epochTripleSelf）
  - APK 已安装，app 首页正常启动（哥林多前书 15:52 金句可见）
  - ✅ **划重点真机验证通过（2026-09-14）**：创世记第1章实测，节号区有黄色高亮（runStart==0 fix），从第2节跨段落拖到第3节两个 ParagraphBlock 均有绿色高亮（同步 dispatch fix），无空洞、无延迟
- Mobile Expo **1.0.38**（iOS build 119 / Android versionCode 119）；夜间审查：**无阻断性新 bug**。
- iOS Maestro 默认冒烟 + 扩展项 PASS；Android Pixel 完整 7 项 PASS（见 `docs/overnight-optimization-2026-08-27.md`）。
- 可还原 App 快照：`.snapshots/`（如 `askbible-app-2026-08-26-0142`）；说明见同目录 `RESTORE.txt`。

### 验收命令

```bash
# Android check 全套（确认无回归）
cd /Users/joshua/Desktop/APP/01AskBible && npm run check:native

# 安装最新 debug APK 到 Samsung（先接好 USB/WiFi ADB）
cd apps/askbible-android && ./gradlew assembleDebug
adb -s R5CW11DNS2K uninstall me.askbible.native
adb -s R5CW11DNS2K install app/build/outputs/apk/debug/app-debug.apk
adb -s R5CW11DNS2K shell am start -n me.askbible.native/me.askbible.native_.MainActivity
```

### 建议下一步（摘自夜间报告 backlog）

**P1 性能（未改）**

- `useMusicStoreBootstrap.ts`：合并冷启动多次 setStore  
- `useHomeNatureVerseAudioPlayback.ts`：金句音频 900ms 轮询 → 事件驱动  
- Read 栈 search/favorites：`freezeOnBlur`  
- `app/_layout.tsx`：`shellFeaturesReady` 900ms 可拆轻量 shell  
- Home 视频双 gate 叠加延迟

**Maestro 覆盖缺口**

- 四 Tab 真点击、计划 FAB、planner 向导、金句点进章页等（报告第三节）  
- 可选实现 `mobile:maestro:overnight` Tier A 六项

**产品临时策略（勿擅自永久化）**

- 金句语音 / 非首曲音乐走 R2 = **TEMPORARY**；恢复全本地需用户明确要求。

### 工作习惯提醒

- 默认只本地改；用户说「上线 / 发布 / push / ship」才 push。  
- iOS 用户说「上传 / 发版 / 上架」= 完整发版一条龙（见 `.cursor/rules/ios-release.mdc`），除非说「只上传不提审」。  
- 讲道集 `/jd` 源在姊妹项目 `03CHURCH`：先 `SKIP_UPDATE=1 npm run deploy:jd` 同步到 `public/jd/`，确认后再单独 commit。

---

## 7. 文档索引（按需打开）

> **防封换线（2026-10-01）**：域名盘点、候选域表、实测数据、操作命令都在 `docs/anti-block-endpoints.md`；
> 代码里不要再写死 `r2.dev` / `askbible.me` / `supabase.co`，一律走 `Endpoints`（iOS / 安卓）或 `lib/endpoints`（网页）。当前状态：网页已上线（备用入口 `https://askbible.joshlabs.app`），安卓站外版 1.0.48 (245) 已发，Play / App Store 未提，见 OPEN-ITEMS O-18。每日灵修只对管理员账号显示（D-23）。

| 主题 | 路径 |
|------|------|
| 愿景 / 原则 / UX | `docs/01-vision.md` … `docs/05-emotional-design.md` |
| Journey / 内容规则 / MVP | `docs/06-journey-system.md` `07-content-rules.md` `08-mvp-scope.md` |
| 危险方向 / 停车场 | `docs/09-dangerous-directions.md` `10-parking-lot.md` |
| 模块边界 | `docs/11-module-boundaries.md` |
| App 进屏 | `docs/mobile-feature-map.md` |
| 发版清单 | `docs/mobile-release-checklist.md` |
| Maestro / 合入 | `docs/mobile-maestro-auto-merge.md` |
| 金句音频 | `docs/mobile-golden-verse-audio.md` |
| 构建产物清理 | `docs/mobile-build-artifacts.md` |
| 后台开发 | `docs/admin-development.md` |
| 过夜审查 | `docs/overnight-optimization-2026-08-27.md` |
| JoshLabs 项目 overlay | `/Users/joshua/Desktop/APP/skills/joshlabs-dev/references/projects/01askbible.md` |

### Cursor rules（任务相关再读）

| 规则文件 | 何时 |
|----------|------|
| `joshlabs-dev.mdc` | 始终（AskBible 覆盖层） |
| `default-app-optimization-first.mdc` | 未指定平台时 |
| `platform-priority-apple-first.mdc` | 多端 |
| `mobile-local-media-playback-first.mdc` | 音乐/视频/金句 |
| `mobile-local-build-only.mdc` | 打包发版 |
| `ios-release.mdc` / `android-release.mdc` | 商店上传 |
| `askbible-production-hosting.mdc` | Render / DATA_ROOT / info-edition |
| `mobile-maestro-auto-merge.mdc` | 改 App 后验收合入 |
| `no-compression-on-remote-fetch.mdc` | 外站拉音频 |
| `ponytail-minimal-implementation.mdc` | 最小实现 |

---

## 8. 给接手 AI 的最短指令模板

把下面整段贴给下一个 Agent 即可：

```text
你在仓库 /Users/joshua/Desktop/APP/01AskBible。
先读 docs/HANDOFF.md，再读 AGENTS.md 与 joshlabs-dev skill。
产品：AskBible.me = 安静进圣经的入口，不是 Bible tool / chatbot / 游戏化。
平台：iOS → Android → Web；App 在 apps/askbible-mobile。
硬禁：不擅自扩功能；禁止 EAS 云构建；媒体不走 askbible.me 增量；PAD 默认关；未要求不 commit/push。
改 App 后跑 npm run mobile:maestro:smoke；合 main 走 PR + npm run pr:auto-merge。
当前 backlog 见 docs/overnight-optimization-2026-08-27.md。
用户说 DD = 质疑后继续。
任务：<在此填写本轮唯一目标>
```

---

## 9. 自检清单（交付前）

- [ ] 改动是否落在本轮唯一目标内？有没有「顺手」扩功能？
- [ ] 是否违反媒体 / OAuth / 构建 / 产品边界硬禁？
- [ ] App 改动是否对照 Feature Map？能否跑 Maestro？
- [ ] 超范围想法是否只进了 `docs/10-parking-lot.md`？
- [ ] 未要求是否避免了 commit / push / 发版？

---

*本文为交接入口；细节以 `AGENTS.md` 与 `.cursor/rules` 为准。状态过期时优先更新本节「当前状态」与过夜报告链接，勿复制整库到其它文档。*


---

# 圣经人物透明立绘（2026-09-11 暂停于此）

## 当前状态

用内置浏览器驱动 ChatGPT 网页版出图，会话是 https://chatgpt.com/c/6aa43ecf-1ed4-83ea-b082-b88ab74a0c96 。

- 出图标准已定版：`docs/figure-portrait-standard.md`（七节 + 速查清单 + 统一模板，Josh 逐轮调教后的结果）。
- 人物底档：`data/figure-visual-profiles/bundle.json`，15 个 profile / 16 个 stage，新增 `facialStructureZh` 字段存各人骨相。
- 已生成 31 张（含重做），file_id 索引在 `data/figure-visual-profiles/chatgpt-batch-2026-09-11.json`，每个人物取最后一条。
- 只有摩西那张取回了本地：`tmp/figure-portraits/raw/moses.png`。

## 两个没解决的问题

1. **假透明**。后半批是 RGB、没有 alpha 通道，灰白棋盘格是 ChatGPT 当成图案画进画面的。前半批（雅各、扫罗那几张）是真 alpha。已在会话里发了纠正并重做摩西，结果还没验。
2. **风格漂成写实**。标准文本里「写实与动画结合」这句把模型带向真人照片感，和 `lib/figures/scene-style-guide.ts` 顶部注释记的坑一致。纠正消息里要求回到明确的 3D 动画角色风。

验证一张图是否真透明：

```bash
python3 -c "from PIL import Image; im=Image.open('tmp/figure-portraits/raw/moses.png'); print(im.mode, im.convert('RGBA').getchannel('A').getextrema())"
```

`mode` 是 RGB 或 alpha extrema 为 (255,255) 就是假透明。

## 出图队列状态（2026-09-11 更新）

最后确认发出去的是：**大卫王（壮年为王，定都耶路撒冷时期）**，`gen: false` = 已生成完毕。

**待发送（按此顺序，每条都必须带完整风格前缀）**：
- 扫罗王（统一以色列王国时期，登基初年）
- 摩西（带领出埃及、旷野时期，中壮年）← 重做，解决假透明+写实漂移
- 亚伯拉罕（蒙召离迦勒底之后，迦南时期，老年）
- 雅各（以色列/与天使摔跤之后，壮年）
- 约瑟（约瑟·创世记，埃及宰相时期，成年）
- 约书亚（征服迦南时期，壮年）
- 耶稣（传道期，30岁出头）
- 马利亚（耶稣母亲，青年，报喜/怀孕时期）← 之前那张丢了，重做
- 保罗（宣教旅程时期，中年）
- 雅各（使徒雅各，耶路撒冷领袖时期）
- 犹大（犹大书作者，中年）

**每条发送的完整前缀（必须逐字粘贴，末尾换行加人物描述）**：
存在 `docs/figure-portrait-standard.md` 最后一节。

## 下一步

1. 开新线程，继续向 ChatGPT 会话发剩余人物（用完整风格前缀 + 人物描述）。
2. 每发一条等生成完（查 `stop-button`），再发下一条。
3. 全部发完后，用三步取图法把所有图取回 `data/figure-visual-profiles/reference-images/`，文件名 `<slug>-adult.png`，回填 bundle 的 `referenceImageAssetId`。
4. 补马利亚（唯一 Josh 认可构图的那张已从会话分支消失，需重做）。
5. 做 Josh 要的管理网页：列已生成 + 待生成，点一下能去生成或重新生成、用新图替换旧图。

## 别踩的坑

- **取图必须拆成三次调用**，一次做完会超 45 秒：先 `/backend-api/files/download/<fid>` 拿 `download_url` 存进 `window.__url`；再 `fetch` 成 blob 存 `window.__blob`；最后 `FileReader.readAsDataURL`。第三次返回 3MB 左右，工具会自动落盘并给路径，字节不进上下文。再用 Bash base64 解码。
- `download_url` 不能拿去 Bash 里 curl，不带会话凭据是 403，只能页内 fetch。
- 发消息用 `form_input` 写 `ref_12`，再用 JS 点 `button[data-testid="send-button"]`；Enter 键和坐标点击都不可靠。点之前先判断 `button[data-testid="stop-button"]` 在不在，在就是还在生成，这时 send 按钮不存在。
- **别用截图轮询进度**，一张上千 token。查 `stop-button` 存不存在就够了。
- 浏览器面板被隐藏时 `setTimeout` 被节流，页内长轮询会超时；改用 `computer wait` 分段等，再单次 JS 查状态。
- 输入框是和 Josh 共用的，`form_input` 会把他正在打的字整段覆盖掉。动手前先查输入框是不是空的。

---

# 交接：成就 / XP 系统第一版（2026-09-18）

## 当前状态

**素材**：MY CLASS 的 40 枚勋章 + 66 卷书卷印章，透明版压 512px WebP（单张约 55KB，共 6.2M），95 张全部已上传 R2 `askbible-media/medals/`，公网可读，两条基址都验过 200：
`https://askbible-media.joshlabs.app/medals/<key>.webp` 和 `https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev/medals/<key>.webp`（代码里用后者，和项目其它素材一致）。

**真源与生成**：`data/medals.json`（23 枚勋章 / 56 档 / 66 卷印章 / 12 级称号 / XP 经济）→ `npm run gen:medals` 生成两端表；`npm run check:medals` 对拍。**不要手改生成物** `MedalCatalog.swift` / `MedalCatalog.kt`。

**iOS 全链路已通，编译通过**（`xcodebuild -project apps/askbible-ios/AskBible.xcodeproj -scheme AskBible -configuration Debug -destination 'generic/platform=iOS Simulator' build`）：
- `Model/AchievementStore.swift` —— 账本 + 判定引擎 + XP + 会员同步的 JSON 出入口
- `Read/AchievementViews.swift` —— 勋章图按需下载缓存、`XPBar` 等级条、`XPFloater` 飘字、`EarnedToast` 获得提示
- `Read/AchievementsView.swift` —— 成就页（勋章墙 + 66 卷印章墙 + 三个数字）
- 接线：`AskBibleApp.swift` 建 store / 注入 / 叠加飘字与提示 / 听读每 15 秒打点 / 打开章 / 计划流读完章；`ChapterView.swift` 新增 `onReachedEnd`（滚到章末 = 读完，点亮印章的唯一入口）和 `onVersesRead`（滚过的节数，微反馈 XP）；`ExploreView.swift` 加等级条卡片，点进成就页
- 新文案键走 `tools/native-copy-extra.json` + `npm run gen:site-copy`

**安卓全链路已通，编译通过**（`cd apps/askbible-android && ./gradlew :app:compileDebugKotlin`）：
- `app/.../data/AchievementStore.kt` —— 与 Swift 版逐条对等（ledger 落 SharedPreferences `achievements`，键 `askbible-achievements-ledger-v1`）。Swift 靠 `Snapshot` 的 `didSet` 落盘，Kotlin 用显式 `dirty` 标记，免得 `attach()` 时空写一次还触发同步通知。
- `app/.../ui/AchievementViews.kt` —— `MedalImages`（HttpURLConnection 下 R2 的 WebP，落 `cacheDir/medals`，无 Coil 依赖）、`MedalIcon`、`XPBar`、`XPFloater`、`EarnedToast`
- `app/.../ui/AchievementsScreen.kt` —— 成就页（勋章墙一行 3 枚 / 印章墙一行 5 枚 / 三个数字），左上返回键
- 接线：`MainActivity.kt` 建 store + `attach` / 听读 `onProgress` 每 15 秒打点 / `LaunchedEffect(book.id, chapter)` 里 `noteChapterOpened` / `skipNext` 计划流里 `noteChapterRead` / 顶层叠 `EarnedToast` + `XPFloater` / `showAchievements` 全屏页 + BackHandler；`ChapterScreen.kt` 新增 `onReachedEnd`、`onVersesRead`（段落 `LaunchedEffect` 去重上报）；`ExploreScreen.kt` 加等级条卡片
- 新文案键 `native.chaptersReadLabel` 走 `tools/native-copy-extra.json` + `npm run gen:site-copy`（iOS 那边原来用「英文界面就显示 Chapters」的土办法，已换成这个键）

## 关键决定
全在 `docs/DECISIONS.md` 末尾两条：「成就系统：复用 MY CLASS 勋章图，三端 + 上会员同步」「XP 要『一直在涨』：微反馈 + 连续乘区 + 大数字」。
ChatGPT 的评审与我的逐条判断在 `docs/gamification-chatgpt-review.md`。

## 下一步（按顺序）
1. ~~等 Josh 拍板 XP 刺激强度~~ **已定 A 方案并在两端落地**（2026-09-18，见 `docs/DECISIONS.md` 末条）：倍率只升不降（`bestStreakDays`）、听读 XP 三重约束（前台 + 在播 + 每章 `listenTicksPerChapterCap`=80 片）。`noteListenTick` 现在要传 `bookId`/`chapter`。
2. ~~**接会员同步**~~ **已完成（2026-09-18，两端编译通过）**，见 `docs/DECISIONS.md` 末条「成就 / XP 账本上会员同步」。落地内容：
   - blob 键 `achievements` 加进三份键表：`lib/member-reading-sync/schema.ts`、iOS `Model/MemberReadingSync.swift`、安卓 `core/.../MemberReadingSync.kt`（RN 那份不加，理由见 DECISIONS）。
   - 三端各加一份 `mergeAchievements`（逐字段：计数取大 / 日期并集 / 勋章取更高档 / 首次时间取更早），挂进各自的 `mergeBlobValue`。
   - 两端 `AchievementStore` 新增 `hasProgress`（空账本不推）。
   - 引擎接线：`MemberReadingSyncEngine.attach(...)` 多收一个 `achievements`，绑 `onLocalChange` → 1.5 秒防抖上传；`exportLocal()` 产出 blob；`apply("achievements")` → `mergeRemote`；`beginApplying/endApplying` 一并压 `suppressChangeNotify`；`clearLocalBlobs()` 一并 `clearForAccountSwitch()`。
   - 调用处：iOS `AskBibleApp.swift` 把 `achievements.attach(...)` 提到 `sync.attach(...)` 之前再传参；安卓 `MainActivity.kt` 的 `syncEngine` `remember` 里多传一个参数。
   - **数据库不用迁移**：`blobs` 是无约束 `jsonb`。
   - 验证：`xcodebuild ... -destination 'generic/platform=iOS Simulator' build` 与 `./gradlew :app:compileDebugKotlin` 均通过。`npm run check:member-sync` **已修好并通过**（164 条用例三端一致），其中新增 5 条 `achievements` 用例。真机端到端（两台设备互相同步勋章）**还没实测**。
3. ~~**网页端**~~ **已完成（2026-09-19）**，详见 `docs/DECISIONS.md` 末条「网页端成就系统」。落地内容：
   - `lib/achievements/medal-catalog.ts`（直接 import `data/medals.json`，不生成第三份表）、`lib/achievements/achievement-store-web.ts`（账本 + 判定引擎 + XP + 同步出入口，模块级 store）。
   - 上报点：`lib/read/read-chapter-completion.ts` 的 `markReadChapterCompleted` → `noteChapterRead`；`components/bible/ReadChapterCompletionSection.tsx` 挂载 → `noteChapterOpened`。
   - 同步：`lib/member-reading-sync/client/reading-sync-local-web.ts` 三处（hasProgress / 导出 blob / apply 分支）；`components/member/MemberReadingSyncBridge.tsx` 挂 1.5 秒防抖推送。
   - 界面：`/explore/achievements` 页 + `components/achievements/`（`AchievementsView` / `AchievementLevelCard` / `achievement-text`），探索页顶部加等级条卡片。
   - 验证（全过）：`npx tsc --noEmit`、`npm run lint`（只剩和既有代码同类的 `<img>` 警告）、`npm run check:medals`、`npm run check:member-sync`（164 条三端一致）、`NODE_OPTIONS=--max-old-space-size=8192 npm run build`、dev 服务器上实测回填 3 章 → 俄巴底亚整卷 → 印章点亮 + 勋章发出 + Lv.5 / 6450 XP。
4. **界面已全面对齐 iOS（2026-09-19）**：勋章档位上色、XPBar 火苗倍率与渐变条、探索页卡片、飘字（顶 90px / 叠 3 条 / 1.1 秒）、获得提示（顶 8px / 羊皮纸卡 / 2.8 秒 / 点一下关）、成就页表头三数字与每枚勋章的下一档进度条，逐项照 `Read/AchievementViews.swift` + `Read/AchievementsView.swift` 复刻；文案与原生共用 `tools/native-copy-extra.json` 这一份真源。详见 `docs/DECISIONS.md` 末条。
5. **还没做的**：网页端的**逐节微反馈 XP**没有数据源（见 `docs/OPEN-ITEMS.md`），飘字 / 获得提示也还没做——网页端目前只有「静态看结果」的成就页，没有原生那套 `XPFloater` / `EarnedToast`。真机端到端（两台设备 + 网页三方互相同步勋章）仍未实测。

## 别踩的坑
- **模拟器上底栏点不动**：iOS 26 Liquid Glass 底栏，`simctl` 注入的 tap 打在首页那层「点空白收起/唤回」的透明层上，切 Tab 没反应。别在这上面耗，要验 UI 直接装真机。
- **模拟器上的 bundle id 是 `me.askbible`**，不是真机的 `me.askbible.native`，`simctl launch` 别用错。
- **Kotlin 的 `const val` 要显式 Double**：生成器里 `listenTickSeconds` 这类必须输出 `15.0`，写 `15` 编译不过（已在 `gen-medals.mjs` 里用 `dbl()` 处理）。
- **`PlanDates.parseLocalDate` 返回的是 `(y, m, d)` 元组不是 `Date`**，要自己 `DateComponents` 拼。
- **`DateComponents` 的参数有顺序**：`weekday` 必须在 `weekOfYear` 前面。
- **AskBible 的 iOS 没有 `Endpoints` 枚举**（那是 MyClass 的），R2 基址各文件自己写字面量。
- **安卓模拟器 emulator-5554 上别做点击验证**：这台机器上有别的项目的 kiosk 启动器（`app.joshlabs.desk`）和 `app.joshlabs.tingdao` 反复抢前台，`input tap` 会落到别的 App 上，dump 出来的「成就墙」是那个 App 自己的页面。要目视验证就装真机。
- **听读 XP 需要「现在听的是哪一章」**：安卓的 `onProgress` 挂在 `remember {}` 里读不到后面的 Compose 值，用 `listenTarget` 这个 `mutableStateOf` holder 由 `LaunchedEffect(targetBook?.id, targetChapter)` 写进去；iOS 直接读 `audioTarget`。
- **`ChapterAudioPlayer.onProgress` 是在 `remember {}` 里一次性挂的**，不要在里面读 Compose 状态；听读打点的「上一次落点」用 `by remember { mutableStateOf(-1.0) }` 在外面存。

---

## 附：2026-09-18 这一轮（欢迎页 + 首页沉浸）交接

### 当前状态

iOS 原生端的一轮 UI 改动，**代码全部写完，模拟器验证做到一半，未提交**。卡点见「别踩的坑」第 1 条。

改完并已在模拟器 AskBible-Glass 上看过效果的：

1. **欢迎页重做**（`Onboarding/WelcomeView.swift`）——不再是登录页。主按钮「开始今日灵修」进首页；语言收右上角轻量菜单；Apple / Google / 邮箱密码 / 注册整套收进右上角「登录」拉起的 `WelcomeSignInSheet`，邮箱密码在 sheet 里再折叠一层。
2. **登录控件**（`Auth/AuthViews.swift`）——Apple 排到 Google 之前（登录页 / 注册页一并受益）；`AuthLink` 去掉 private（欢迎页要用）；控件底色 `0xFFFCF5/0.62` → `0xF8F1E3/0.72`，输入框圆角 10 → 8；`AuthSubmit` 主按钮改琥珀 `0xffb101/0.22`。
3. **首页闲置全景**（`Home/HomeView.swift` + `AskBibleApp.swift`）——闲置 7 秒后系统底栏、设置齿轮、分隔线一起淡出，只留全景 + 金句 + 三颗常用键（音乐 / 朗读 / 下午茶，压淡 0.55）。走的是音乐页 `musicChromeHidden` 那条现成的路，新增 `homeChromeHidden`。
4. **首页去玻璃底**（`Home/HomeView.swift`）——设置簇不再垫 `askGlassRect`；簇内图标阴影升到黑 0.45 / r4，闲置态不透明度 0.78 → 0.95。
5. **探索页收起文章格**（`Explore/ExploreView.swift`）——`articleGrid` 调用注释掉，函数和数据留着。**这一条还没在模拟器上看过。**
6. **文案**——`tools/native-copy-extra.json` 加了九条 `native.welcome*` + `native.todayDevotion`，跑过 `node tools/gen-site-copy.mjs`（iOS 和安卓两端 SiteCopy 都是生成物，别手改）。

### 怎么验证

```bash
cd apps/askbible-ios
xcodebuild -project AskBible.xcodeproj -scheme AskBible -configuration Debug \
  -destination "id=4C1D3CEB-DA49-4605-A675-B7C31022B488" build
xcrun simctl install 4C1D3CEB-DA49-4605-A675-B7C31022B488 <.app 路径>
xcrun simctl launch 4C1D3CEB-DA49-4605-A675-B7C31022B488 me.askbible
```

要重看欢迎页：删掉容器里那一个键，**不要卸载 App**（会清登录态）：

```bash
C=$(xcrun simctl get_app_container 4C1D3CEB-DA49-4605-A675-B7C31022B488 me.askbible data)
/usr/libexec/PlistBuddy -c "Delete :onboardingCompleted" "$C/Library/Preferences/me.askbible.plist"
```

模拟器 bundle id 是 `me.askbible`（不是 `me.askbible.native`，那只是 App Group 名）。

### 关键决定

全部在 `docs/DECISIONS.md` 2026-09-18 那几条，按时间读：欢迎页改版 → 首页成为灵修落地页（**已作废**）→ 灵修就是沉浸式首页本身（推翻上一条）→ 下午茶与专注是两个东西 → 每日读经不做首次引导 → 首页闲置底栏退场 → 设置簇去玻璃底。

**最重要的一条**：灵修 = 全景场景 + 经文 + 音乐这件事本身，不是一篇文章。ChatGPT 给的整套方案建立在「灵修 = 文章」的错误前提上，已作废，别再照那套推。

### 别踩的坑

1. **同项目还有别的会话在写代码**（2026-09-18 当晚有三个）。这一轮两次被别人的半成品挡住编译：先是 medals 的 `Endpoints`（已修），后是成就系统的 `AchievementStore.hasProgress`。动手前按 `~/Desktop/APP/CLAUDE.md` 第 6.4 节先 `ListAgents` + 看文件 mtime。
2. **首页那层「点空白收起/唤回」的 `Color.clear` 必须有明确尺寸**（`frame(width:height:)`），否则不参与点击命中，底栏退场后点屏幕叫不回来。
3. **同一处别用 `toggle()` + `touch()`**：`touch()` 里有「不可见就唤回」的逻辑，会把刚收起的界面立刻弹回来。先算 `let next = !chromeVisible` 再赋值。
4. **首页上浮的按钮要 `.zIndex(1)`**，否则被那层整屏点击层吃掉（表现像按钮失灵）。
5. **iOS 26 的 Liquid Glass 底栏不吃 `.toolbarBackground(.hidden, for: .tabBar)`**，试过，玻璃胶囊底照样在。要「不被压着」只能让它整个退场。
6. **`.clear` 玻璃在浅色场景上会提亮成一块发白的板子**，风景被蒙住。首页现在没有任何一块玻璃底。
7. **模拟器上验不了「点空白唤回」**——本文第 422 行早就记了：`simctl` 注入的 tap 打不中首页那层透明层。
   我这轮没先看这条，为此换了三种手势写法白试了三轮。要验这类交互直接装真机（Release 包，见 APP/CLAUDE.md 7.0）。
8. 内置浏览器里 ChatGPT 页面**不能 fetch 本地 http 服务**（CSP 挡 connect-src），想把截图发给它要走 Chrome 扩展的 `file_upload`。

### 下一步

1. 等同项目其它会话把编译修通，`xcodebuild` 跑一次，验证第 5 条（探索页格子确实不见了，且读经计划页的「麦克阿瑟研经法」链接仍能打开文章页）。
2. 验证通过后提交（Josh 的规矩：说明改动 + 聊天确认 → 直接推 main）。
3. `docs/OPEN-ITEMS.md` 里 2026-09-18 还剩「第 3 屏今日读经引导（已定为不做）」之外的活口，接手前扫一眼。

---

## 附：2026-09-19 ~ 20 这一轮（配色收敛 + 跟读按句 + 成就音效）交接

### 当前状态

**全部已提交并推送 main**，两台真机装过（iPhone 最后一版未装，见下一步 0）。
本轮四个提交：`4630e1fd`（色板 + 跟读按句）、`038ae43b`（安卓 sideload 变体）、
`b9376bc1`（高亮重叠 + 进度条可拖）、`7720806b`（成就音效 v1）、
`4c608f4b`（开关色修正 + 状态色锁规则）、`74e758c7`（成就反馈 v2）。

做完的四件事：

1. **划重点四色板换新**（四端）。`#7BC96F`/`#0FBCDB`/`#F48FB1` →
   `#A3B565` 橄榄绿 / `#4E86A0` 青石蓝 / `#C0625F` 石榴红，灯油黄 `#FFB103` 保留。
   高亮一律「颜料 + alpha」铺在羊皮底上，**每端只留一个上色入口**：
   - 网页 `lib/read/read-verse-text-highlights.ts` → `verseTextHighlightStyle()`（注入
     `--vh-rgb`/`--vh-a`/`--vh-a-dark`，深浅由 CSS 切，JS 不参与）
   - iOS `Model/VerseTextHighlights.swift` → `VerseHighlightRules.fillColor()`
   - 安卓 `ui/ChapterFlowParagraph.kt` → `verseHighlightFill(hex, dark)`
   - RN `src/read/read-verse-text-highlights.ts` → `verseTextHighlightFill()`
   **四端各带一张旧→新 hex 迁移表**写在 `normalizeColor` 里，老用户画过的重点不会被
   打回默认黄。测试 `lib/read/read-verse-text-highlights.test.ts` 5 条盯着这件事。
2. **跟读高亮从「按节整行铺底」改成「按句、贴着字铺」**（四端）。
   新增 `VerseSentences`（Swift / Kotlin / TS 三写 + RN 一份拷贝）：按 `。！？；!?;` 切句，
   收尾 `」』”）` 并进本句，逗号顿号冒号**不**切。播放器新增节内进度
   （`activeVerseProgress` / `activeVerseProgressAt`），节内按非空白字数比例插值定位当前句。
   网页 `hooks/useReadChapterFollowSentence.ts`、RN `useReadChapterAudio.ts`
   **顺带把关掉的跟读高亮重新打开了**（原来 `activeIndex` / `activeVerseIndex` 写死 null）。
3. **全局只留一种绿**：`#34C759` 全下掉，收敛到仓库已有的
   `READ_DONE_ACCENT = "#65775C"`，补了深色版 `READ_DONE_ACCENT_DARK = "#A8BC72"`。
   状态色四档已锁成硬规则，见 `docs/DECISIONS.md` 同日那条。
4. **成就反馈（XP / 勋章 / 升级）加声音 + 触感 + 动效**，v2 做了声音分层。
   纲领：**小事靠触感，完成靠声音，成就靠钟声，升级靠光。**
   三端各一个 `AchievementFeedback`（iOS `Model/`、安卓 `data/`、网页
   `lib/achievements/achievement-feedback-web.ts`），四个音 `xp`/`chapter`/`earn`/`levelup`
   由 `tools/gen-achievement-sfx.py` 本机合成（numpy，非谐波分音 + 合成混响），
   三端各存一份：`apps/askbible-ios/AskBible/Resources/sfx/`、
   `apps/askbible-android/app/src/main/res/raw/sfx_*.m4a`、`public/sfx/`。
   开关在三端成就墙里，默认开，键 `askbible-achievement-sound-v1`。

### 怎么验证

```bash
cd /Users/joshua/Desktop/APP/01AskBible
npx tsc --noEmit -p tsconfig.json                      # 网页
npx tsc --noEmit -p apps/askbible-mobile/tsconfig.json # RN
npx vitest run                                          # 259 条
npm run check:site-copy                                 # 文案真源与两端一致
cd apps/askbible-ios && xcodebuild -project AskBible.xcodeproj -scheme AskBible \
  -configuration Release -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates -derivedDataPath /tmp/claude-501/ios-rel build
cd ../askbible-android && ./gradlew :app:assembleSideload
```

改了音效参数后重新生成并同步三端：

```bash
cd /tmp && python3 /Users/joshua/Desktop/APP/01AskBible/tools/gen-achievement-sfx.py
for f in xp chapter earn levelup; do ffmpeg -v error -y -i $f.wav -c:a aac -b:a 96k -ac 1 $f.m4a; done
# 再 cp 到上面三个目录（安卓的文件名要加 sfx_ 前缀）
```

### 下一步（按顺序）

0. **装最新版到 home iPhone**。本轮最后一版（`74e758c7`，成就反馈 v2）三星已装，
   **iPhone 没装**——当时手机不在线。Release 包当时预编在 `/tmp/claude-501/ios-rel/`，
   **那是临时目录，可能已被清**，按上面的命令重编一次再装即可。
1. **「读完一章」的专属动效**（GPT 和我都认为最该补的一条）。现在章完成有
   **声音（小钵）+ 触感**，但**没有专属动效**，还是复用 +XP 的飘字。
   目标形态：阅读进度线完成 → 金色短暂亮起 → 回归静止，**不要弹 Toast**。
   卡点：要先定动效挂在哪（章页底部进度条？顶部章节标题？），这要动读经页布局。
2. **连续天数（streak）反馈**（价值最高）。现状：`streakDays()` 只参与算倍率，
   **延续 / 中断都不发事件**，界面毫无动静。建议：延续 = 当天第一次完成时轻触感 + 小钵、
   不弹卡片；**中断什么都不给**，安静归零，不要用声音惩罚用户。
   要动 `AchievementStore` 发新事件，三端都要改。
3. **今日计划完成的反馈**，建议和第 2 条一起做。
4. **语义色四档抽成三端共享 token**（规则已锁，只剩结构性改动）。

### 别踩的坑

**这一轮新踩的，压缩后会丢，都记在这里：**

- **模拟器坐标换算**：iPhone 17 Pro 截图宽 918px，设备点宽 402，**比例 0.4379**
  （`点 = 图 × 0.4379`）。按 2x 或 3x 硬算全部打偏，我在这上面白点了七八次。
  机型用 `plutil -p ~/Library/Developer/CoreSimulator/Devices/<UDID>/device.plist | grep deviceType` 查。
- **`inspect` 动作在这台机器上不可用**（返回「use screenshot instead」），只能靠截图 + 换算。
- **安卓真机装不上 release**：手机上的 `me.askbible` 是 **Play 商店版**
  （`dumpsys package me.askbible | grep installerPackageName` = `com.android.vending`），
  被 Play App Signing 重签过，本地 upload key 打的包**永远覆盖不上去**。
  **不要卸载重装**（会清掉 Josh 的登录和设置）。用 `./gradlew :app:assembleSideload`
  打 `.native` 后缀的并排包。**任务名是 `assembleSideload` 不是 `assembleSideloadRelease`**。
- **adb 两个端口 5555 / 32929 连的是同一台机**（SM_S918W）。换端口解决不了签名问题。
  端口会变，先跑 `~/bin/connect_devices.sh`。
- **iOS `error 1016 (has not been unlocked recently)`**：手机自**重启以来一次都没解锁过**，
  开发者配对凭据解密不出来，`xcodebuild` 会卡在等 destination 然后超时。
  **没有绕过的办法**，只能请 Josh 解锁一次。日常锁屏安装是可以的，不要预先要求他解锁。
- **iOS 覆盖安装这次没出问题**：`devicectl install` 直接盖上去、启动正常（验过进程存活 3 秒）。
  7.1 说的「必须先卸载」这次没走，为的是保住登录状态。若日后出现秒退再按 7.1 卸载重装。
- **双重压透明**：iOS `ChapterFlowParagraph.swift` 画划重点时原来有
  `run.color.withAlphaComponent(0.45)`、安卓有 `c.copy(alpha = 0.45f)`——
  颜色已由 `fillColor`/`verseHighlightFill` 带好 alpha，会被乘两次。两处都已删。
- **逐行铺色不能纵向撑高**：原来 iOS `insetBy(dy: -1)`、安卓 `-1.dp/+2.dp`，
  相邻两行重叠 2pt，半透明叠出一条深色带。已改成不纵向撑。
- **Xcode 工程用 `PBXFileSystemSynchronizedRootGroup`**，往 `AskBible/` 下丢新 `.swift`
  或 `Resources/sfx/*.m4a` **会自动纳入**，不用改 pbxproj。
- **`SiteCopy` 是生成物**：改文案要改 `tools/native-copy-extra.json` 再
  `npm run gen:site-copy`，`npm run check:site-copy` 自检。
- **浏览器自动化 ChatGPT 的三个坑**（2026-09-20 实测）：
  1. `form_input` 填的是隐藏 textarea，**真正的 composer 收不到**，页面看着是空的；
     要先 `computer left_click` 点进输入框再用 `type`。
  2. **回车不发送**（只插换行）。必须点发送按钮：
     `document.querySelector('[data-testid="send-button"]')` 取 rect 再点。
  3. **坐标要换算**：页面 CSS viewport 是 1024x768，但截图帧是 800x600，
     **比例 0.78125**。直接用 `getBoundingClientRect` 的值会报「outside the coordinate frame」。
  读回复用 `main.innerText` 切片，不要用 `article`（这个版本的 DOM 里查不到）。
- **仓库里长期有别的会话在写** `docs/story-scripts/*.md` 和 `.gitignore`。
  提交一律 `git commit -F - -- <自己的路径>`，**不要裸 `git commit`**、不要
  `git add -A` 之后直接提交。本轮六次提交全绕开了那两个文件。

---

## 附：2026-10-01 官网 + 网页版搬到 /web 交接

**当前状态（2026-10-01 夜）**：官网首屏改成几个软件的入口（D-22：一排图标切换，标题 / 入口 / 手机画面跟着换，等 Josh 看）、官网加了「同系列工具」一节（D-21：听到 / 查到 / 小小圣经）、原生首页金句换思源宋体（D-19，两端已改，iPhone 已装、三星没装）、官网（D-10）、网页版首页对齐安卓（D-11）、探索页照安卓（D-12）、撤掉网页专有设置（D-13、D-18）、
菜单「回主页」（D-14）、官网手机模型放真的网页版（D-15）、下载入口加图标（D-16）、安卓「最新版 / 商店版」二选一（D-17）都做完、本机验过、
**2026-10-02 Josh 说「发布」「上线」，这一整批已合进 main 并推送（Vercel 自动部署）**；官网上不写备用地址（D-22 补充）。
之前是在分支 `claude/upbeat-mayer-752c72`（worktree `.claude/worktrees/strange-dewdney-3855d7`）上做的。主目录 `~/Desktop/APP/01AskBible` 里有别的会话没提交的改动，
所以是从 worktree 直接 `git push origin HEAD:main` 推的（`e9851a81`）；主目录的本地 main 随后由「防封换线」会话快进到同一个提交，那边没提交的改动原样保留。
**线上已核对（2026-10-02 00:25，Vercel 部署成功）**：`askbible.me/` 是新官网（四个软件切换、听到 / 查到 / 小小圣经的地址都在）；`/web`、`/app`、`/explore`、`/read` 都是 200；
manifest `start_url=/web`；手机截图和金句字体文件都取得到。本机的 `npm run build` 当时 10 分钟没跑完被中止（不是报错），是靠 Vercel 的构建把的关。
之后只推文档的提交也是 `git push origin HEAD:main`，推完主目录要 `git pull`。
2026-10-01 晚已把 main（`2ad8b200`，「防封换线」那一批，已上线）**合进本分支**：两处冲突（`AppInstallGuidePage.tsx`、`useNatureGoldenVerseAudioControl.ts`）两边都保留，`tsc` + 271 个单元测试通过；本分支现在只领先 main、不落后，上线时可以直接快进合并。

**下一步（按顺序）**：
0. **首屏四个软件自动轮播（D-25）**：~~等 Josh 说「上线」~~ **2026-10-03 已合进 main（`1599f0ee`）并推送上线**（Josh「合进，上线，清掉，代码留着」）；听到图标反色试看没合，还留在 worktree `strange-dewdney-3855d7` 未提交。验证时注意：浏览器面板在后台时 `document.hidden` 为真，轮播按设计不走，
   定时器也会被限速，用轮询量会得到乱序的假象——要么把面板切到前台，要么临时覆盖 `document.hidden` 再用 MutationObserver 记选中项的变化。
0. **听到图标反色试看（O-23）**：worktree 里有**没提交**的改动（`SiteHome.tsx` 的 `SITE_APP_ICON.tingdao` + `public/site/sibling-tingdao-inverted.png`），等 Josh 看了定；没定之前别把它带上线。
0. ~~标志配色（O-22）~~：2026-10-02 已定并上线（DECISIONS D-24）：顶栏和切换条用金黄 App 图标，入口里的小标志单色。
1. **三星装原生金句宋体版（D-19，OPEN-ITEMS O-15）**：两端代码已改完并提交在本分支，home iPhone 已装 1.1.2 (133)；三星 10-01 晚不在线没装。
   三星上线后打 `sideload` 变体（包名 `me.askbible.native`，别盖商店版）。这个 worktree 里没有 `apps/askbible-mobile/android/keystore.properties`
   （不进仓库），先从主目录拷过来再打，不然出来的包没签名；本机没有 `local.properties` 时用 `ANDROID_HOME` 指 SDK。
   Josh 看过手机后要是对英文金句用系统衬线体有意见，改 `VerseFont`（安卓 `ui/VerseFont.kt`、iOS `Theme/VerseFont.swift`）。
2. 官网已上线；Josh 看了首屏的软件切换（D-22）和最下面「同系列工具」那一节（D-21）有意见再改，还开着的几条见 O-17。文案在 `components/site/site-home-copy.ts` 的 `hero*` / `sibling*`；地址在 `lib/sibling-app-urls.ts`；
   手机里的截图在 `public/site/<名>-screen-N.webp`，换图就把新图裁成 600×1299 的 webp 覆盖同名文件。
   之后的编号顺延：
2. Josh 逐页看网页版时再提的不一致，照「以安卓代码为准」处理。
3. ~~Josh 说「上线」后合 main、推送~~（2026-10-02 已做）。还差：Josh 用手机点一次主屏上已装的图标，确认会自动进 `/web`（O-9 第 2 条）。
   安卓 1.0.48 (245) 是别的会话 10-01 从 main 发到下载页的，**不含**金句宋体（D-19）；下一次发安卓版才带上。
4. 待他决定的：O-13（菜单里的「金句停顿」要不要也去掉）、O-14（首页水合报错要不要修）、D-14 的「主页」是不是指官网。

**探索页（D-12）改在哪**：`components/explore/ExploreHomeContent.tsx`（只留文章格子）、`ExploreReadingHabitStats.tsx`（顺序）、
`ExploreRecentChapters.tsx` / `ExploreRecentBookmarks.tsx`（空状态、「更多」）、`app/(app-shell)/explore/explore-parchment.css`（尺寸）。
验证：`/explore` 在 375 宽下量 DOM——标题 x=22、进度条 x=52、统计 / 成就卡 x=24、最近阅读 / 收藏 x=26、格子 x=22 且只有 3 个；
各块间距 26 / 22 / 20 / 18 / 6 / 20 / 8 / 20 / 4 / 68，和 `ExploreScreen.kt` 里的 Spacer 一一对应。

- `askbible.me/` = 官网：`app/(site)/page.tsx` → `components/site/SiteHome.tsx`（样式 `site-home.css`，新文案 `site-home-copy.ts`；
  四条原则 / 怎样陪你 / 我们不是什么直接复用 `components/about/about-page-copy.ts`）。
- `askbible.me/web` = 网页版首页：`app/(app-shell)/web/page.tsx`（从 `(app-shell)/page.tsx` 原样搬过来）。常量 `lib/web-app-home-path.ts`。
- `askbible.me/app` = 安卓下载页，没动。

**原生金句字体怎么验**：安卓 `./gradlew :app:compileSideloadKotlin`；iOS `xcodebuild … -configuration Release -destination generic/platform=iOS build`（手机连不上时用通用目标编，再 `devicectl` 装）。

**验证**：`npx tsc --noEmit`、`npx vitest run`；`npm run dev` 后看 `http://localhost:3450/`、`/web`、`/index`（应跳 `/web`）、`/manifest.webmanifest`（`start_url` 应是 `/web`）。

**别踩的坑**：
1. 网页版里「回首页」一律用 `WEB_APP_HOME_PATH`，别再写 `"/"`。`public/sw.js` 和 `lib/read/parchment-shell-boot.ts` 是纯字符串脚本，里面的 `/web` 是写死的，改路径要一起改。
2. 根布局里的 Provider（音乐、羊皮卷外壳）对官网也生效，所以「是不是自然首页」的判断里 `/` 和 `/web` 要分清：
   `isNatureHomeShellPath` 不含 `/`（官网不预取风景视频、不出底栏）；羊皮卷外壳的排除名单两个都含（官网自己管底色）。
3. manifest 的 `id` / `scope` 不能跟着 `start_url` 改，改了已装的 PWA 会被当成另一个应用。
4. 官网深色时会临时改 `<html>` 底色和 `theme-color`，离开时还原（`SiteHome` 里的 effect）。
5. 繁体靠 `toZhTwText` 逐字表转，新文案里出现表里没有的字就不会转。加文案后用 opencc-js 对照一遍（这次补了「优 缓 样 浏 槛」和「放松 / 轻松 / 日历」）。
6. **网页版首页已向安卓看齐（D-11）**：改首页按键 / 底栏时以安卓 `HomeScreen.kt`、`ShellTabBar.kt` 为准，别再往网页首页加安卓没有的键。
   底部工具的展开状态在 `NatureVideoExperience`（`sceneToolsOpen`），开关是右上角 `NatureHomeToolsToggle`。
   金句字体 `.font-verse-song` 在 `app/globals.css`：D-27 起网页和原生都是系统字体粗体，宋体文件已删（`scripts/build-verse-font.py` 停用备查）。
7. **探索页的统计数和进度条是和读经页共用的组件**（`ReadTodayReadingStats` / `ReadYearDayTimeline`，`ReadTodayPlanPanel` 也在用）：
   探索页的尺寸是在 `explore-parchment.css` 里用 `.explore-habit-*` 包一层覆盖的，别去改组件本身。
8. 探索页左右留白：外层羊皮卷栏有 20，`.explore-home` 只补 2（合计安卓的 22）。
10. 官网手机模型里是 iframe 内嵌的 `/web`（D-15）：给站点加 `X-Frame-Options` / `frame-ancestors` 这类响应头时要放行同源，不然手机里只剩垫底截图。
12. 官网「同系列工具」（D-21）：三张卡的地址集中在 `lib/sibling-app-urls.ts`（查到已换成 `cd.askbible.me`）；图标在 `public/site/sibling-*`。
    加中文文案后照第 5 条用 opencc-js 对一遍繁体（这次补了「课 蜡」）。这一节用 `.site-home__versions--single`，宽屏也一行一张，别改回两列（三张会落单）。
15. **线上的 `/index` 不会跳 `/web`**：Vercel 把 `/index` 当成根路径，直接显示官网（响应头 `x-matched-path: /`）；本机 dev 才会走 `app/(app-shell)/index/page.tsx` 跳 `/web`。
    代码里没有任何地方链到 `/index`，所以没管（O-9 第 5 条）；别拿它当「回网页版首页」的地址用。
16. `public/branding/app-icon.png` 是**透明底 + 白色标志**的母版，只能垫在深色 / 品牌黄上用；浅色底上要标志就用 `SiteLogoMark`（单色跟文字色），要 App 图标就用 `icon-512.png`（黄底）。
    想知道一张图是什么颜色又不想看图：用 PIL 缩到 64×64 统计主要颜色和四角像素。
13. 官网首屏软件切换（D-22）：`.site-home__hero-text` 是**从上往下排**的，别改回垂直居中——各软件的标题、入口高矮不一，居中的话一点切换，那排图标会上下跳。
    首屏淡入的延时写在 `.site-home__hero-text > :nth-child(4/5)`，往里加减子元素要跟着改序号。AskBible 以外的手机画面在 `SitePhoneShowcase.tsx`。
14. 「防封换线」之后（`docs/anti-block-endpoints.md`）：网页里别再写死 `r2.dev` / `askbible-media.joshlabs.app` / `supabase.co`，R2 资源用 `lib/endpoints`，APK 直链用 `lib/app-install-urls.ts`；
    图标字体改成从 npm 包引（`material-icons`、`@mdi/font`），新开的 worktree 要先 `npm install`。`lib/sibling-app-urls.ts` 是给人点的外站入口，不在此列。
11. 安卓发版顺序：先 `deploy_android.py` 发下载页，再推 Play——官网把下载页那个包叫「最新版」（D-17）。
9. 暗度 / 模糊 / 金句特效在网页首页已经不读偏好了（D-13），但 `lib/` 里的读写函数别删，会员同步还在用它们和 RN / iOS 互通。


## 附：YouTube 金句放松视频交接（2026-10-03）

### 当前状态
- 方向（D-5 最新几条）：每集只发**英文一支**（音乐版，原音轨纯音乐 + Studio 里加「中文」「英语（美国）」两条朗读配音 + API 传英 / 繁 / 简三条字幕轨）；被主张的配乐《安息在祢恩典中》整首不用（D-9）。
- 英文第 1–9 集**已全部渲染**，文件在 `00/youtube/en-ep01…09/`（成片 / 两条配音 / 三语 SRT / 章节），封面在 `00/youtube/covers/en-epNN-music.jpg`。
- 后台在跑 `python3 scripts/youtube-series-run.py --from 1`（日志 `00/youtube/series-run.log`）：按集传成**私享**、自动传字幕轨、配音分段暂存 R2；每天额度约 3 支（上传 1600 + 字幕 1200），用完自动等美西午夜。
- 旧版：第 1、2 集旧英文 `ep01-en-music` / `ep02-en-music`、第 3、4 集 `ep03/04-en-dual-old` 仍公开或私享着，新版 `finish` 时自动改私享；永久删除由 Josh 在 Studio 做。

### ★ 2026-10-04 15:41 九集全部完成
- 英文第 1–9 集都已公开、中英两条配音都「已发布」、三语字幕已传、旧版都改私享：
  ptpo6B-M61o / 7ZbspnYmkH0 / DOYikZeoCDo / FHceB3UfW2E / rSvIdJgrBQQ / UV84qlo2vY4 / FOJmx1vU6h0 / 60E5XiDpT14 / vX1Z_JtwrjQ。
- 1–6 集文件已在 18T `素材备份/01AskBible/youtube/`；7–9 集（约 18G）在 `~/素材备份待移`，插盘后跑 `~/bin/archive_to_drive.sh`。
- 剩下只有 Josh 自己做的：Studio 里永久删除 12 支私享旧版（ep01/02 en/tw/zh 纯音乐、ep01 zh 朗读、ep03/04 tw/zh dual、ep03/04 en dual-old）。
- 下面是过程记录，下次再出新集照着做。

### 2026-10-03 改（D-29）：传完直接公开
- 新版传完直接公开，旧版同时改私享；`auto-public` 兜底进程在跑（日志同 `series-run.log`，前缀 `auto-public：`）。下面第 4 步不再需要 `claims-ok`，`finish` 只负责删 R2 暂存、搬待移区。
- 第 1 集新版 https://youtu.be/ptpo6B-M61o 已公开，旧版已改私享，字幕已传；10:xx 在加两条配音。第 2 集 09:20 起重新上传（之前传了 1.9 GB 的那次在重启时丢了）。
- **配音本机直传**（不经 R2）：`dubs-pending` 拉起 `~/bin/serve-local-files.py`（127.0.0.1:8765，日志 `00/youtube/local-file-server.log`）；Chrome 的 Studio 已允许「本地网络访问」。加配音时页面每 30 秒请求 `/__status/<进度JSON>`，后台 `grep` 这个日志等 done / error，不用一轮轮去页面查。
- **加配音脚本 10-03 修过**：Studio 弹窗文字里词之间是换行，原来按「音频 已发布」找永远匹配不上，卡在「上传中…」；已改成先把空白统一成空格再比。「已发布」出现后文件才真正上传（约 0.4 MB/s），用 `nettop` 看 Chrome 上行降到 0 才算完。
- **10-03 12:17 第 1 集 finish 完**（配音两条已发布，文件进待移区）。第 2 集配音已提交，等处理完 finish。当前 `--from` 进程（09:20 起）内存里是旧 `save_state`，会把 finish 标记盖掉：`dubs-pending` 又列出已 finish 的集就再跑一次 `finish <key>`（可重复跑）；下次重启后新 `save_state` 会合并，不再有这问题。
- **10-03 22:40 进度**：第 1–4 集全部 finish（文件在待移区，18T 拔了，插上后手动 `~/bin/archive_to_drive.sh`）；第 5 集配音已提交、处理中；第 6 集在传；7–9 排队。
- **配音状态别信页面上的「正在处理…」**：Studio 页面不一定自己刷新，第 3 集早就「已发布」了页面还挂着「正在处理」。现在在一个空闲 Studio 标签页里放隐藏 iframe，每 10 分钟重载 `…/translations`，把状态报到 `/__w-epNN/`，后台 grep。「处理失败」→ 直接删掉重加（D-29 补充）。
- **「没有有效授权」可能是断网**：10-03 18:36–21:07 断网，`youtube-upload.py` 把刷新失败一律当授权失效；已改成只有 RefreshError 才这么报。
- **10-04 09:30 进度**：7/8/9 配音已提交（解锁后），6–9 都在 YouTube 处理，`watch2.sh` 式后台等完成后 finish。监视 iframe 要放在**窗口当前激活的那个标签页**里：后台标签页放久了会被 Chrome 冻结（CDP 执行一直超时），里面的监视也停。Studio 刷新后的页面 CSP 不许 `new Function`，加配音脚本只能整段贴。
- **10-04 04:45 进度**：9 集视频全部传完公开（`--from` 进程 04:12「全部完成」已退出）；7 FOJmx1vU6h0 / 8 60E5XiDpT14 / 9 vX1Z_JtwrjQ 的配音等屏幕解锁再加；6 配音处理中。全部 finish 后：重跑 `finish` 补 1–4 集被旧进程盖掉的标记（可重复），再提交推送（HANDOFF 下一步第 5 条）。
- **10-04 02:45 进度**：1–5 集完成；6 集配音处理中；7 集（FOJmx1vU6h0）已公开、配音**等屏幕解锁**再加（锁屏时页面 hidden，Studio 弹窗不出）；8、9 排队。`osascript` 取不到 frontmost 进程 = 锁屏。
- **别踩**：别用 `sed -i` 改正在被写的 `series-run.log`（换了文件，运行中的进程写丢）；别杀 `--from` 进程而不管它的 `youtube-upload.py` 子进程（会变孤儿，重启后重复上传）。

### 下一步（每支传完后）
1. `python3 scripts/youtube-series-run.py dubs-pending` 取待加配音清单。
2. **Chrome 必须登录有 AskBible.me_Still 的 Google 账号**（10-01 起两个 Chrome 分别登录了「榴莲英语」和「BIGAPPLE」，**这一步现在卡住，要 Josh 切账号**）。按 A：Claude 自己 `osascript` 把 Studio 标签页所在窗口提到最前（页面必须 visible），做完切回原应用。
3. Studio `studio.youtube.com/video/<id>/translations`：页内 fetch R2 分段拼 File → 添加语言 → 音频「添加」→ 塞进 `#audio-file-loader` → 发布 → 更新（参考 `scripts/youtube-studio-add-dubs.js` 和本线程分步写法）。**点发布后要留在页面直到上传完**（上行约 0.4 MB/s，一条 300 MB 约 13 分钟；用 `nettop` 看 Chrome Helper 的 bytes_out）。
4. 两条都从「正在处理…」变「已发布」后，Studio「版权」页确认没主张 → `claims-ok <key>` → `finish <key>`（公开、删 R2 暂存、旧版改私享、整集搬进待移区）。
5. 9 集都 finish 后提交推送（只提交 YouTube 相关文件；`scripts/youtube-golden-verses.py` 里有版权会话加的 MUSIC_SKIP，一起带上）。

### 别踩的坑
- 后台标签页 Studio 弹窗不渲染、定时器被节流；Trusted Types 禁止建 Worker。
- 配音不能和视频原始语言同名：英文视频的 English 朗读标「英语（美国）」。
- 插盘自动搬运会因 macOS 权限失败（rsync `Operation not permitted`），要给 `/usr/bin/rsync`、`/bin/bash` 开完全磁盘访问权限，或手动在终端跑 `~/bin/archive_to_drive.sh`。
- zsh 里通配符没匹配会让整条命令中止；`rm` 带变量路径会被安全检查拦，用写死的路径。
