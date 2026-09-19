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
| **Web 站点** | Next.js；生产在 **Render + Persistent Disk**（不是 Vercel） | `app/`、`components/`、`lib/` |

`AGENTS.md` 写「不要先做 Journey/CMS」= **不要新开产品线堆功能**；不是禁止修现有 App bug / 发版 / 对齐 iOS。

默认实现基线：**App 优化优先** → 平台顺序 **iOS → Android → Web**。

---

## 2. 硬禁令（违反即错）

1. **不擅自扩功能**；与边界冲突先短质疑 + 更紧方案，等确认（或 `DD`）。
2. **移动端禁止 EAS 云端构建**；iOS 本机 Xcode，Android 本机 Gradle。见 `docs/mobile-release-checklist.md`、`.cursor/rules/mobile-local-build-only.mdc`。
3. **媒体**：播放默认本地；大体积增量 **禁止** 走 Render / `askbible.me`。  
   - 音乐：安装包每专辑**第一首**；其余 TEMPORARY = **Cloudflare R2** + 本机缓存。  
   - 金句语音：TEMPORARY = **R2 直链**（勿回落 askbible.me）。  
   - **禁止**为上架开 `MOBILE_ANDROID_MUSIC_PAD=1`（会打出约 650MB AAB；正常约 160MB）。  
   真源：`.cursor/rules/mobile-local-media-playback-first.mdc`、`docs/mobile-golden-verse-audio.md`。
4. **外站拉取音频等**：禁止压缩/转码/降码率；原样直存。`.cursor/rules/no-compression-on-remote-fetch.mdc`。
5. **OAuth**：从 App 发起的登录默认回调回 App；勿盲目改成网页 HTTPS 回调。验收：`.cursor/skills/验收-OAuth/SKILL.md`。
6. **未要求不 commit / 不 push / 不发版**。Push `main` 会触发 Render 全量 build + CI。
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
| 数据 | 本地优先：`data/` + sqlite；生产磁盘 `DATA_ROOT`（Render） |
| 部署 | Render Web Service + Persistent Disk |
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
