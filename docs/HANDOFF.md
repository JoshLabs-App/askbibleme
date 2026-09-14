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
  - App Review 提交时间：`2026-09-14T04:51:02Z`，状态 `WAITING_FOR_REVIEW`
  - 提审用 ASC API：`PATCH /v1/reviewSubmissions/{id}` + `attributes: { submitted: true }`（文档未记载的隐藏字段）
- Mobile Expo **1.0.38**（iOS build 119 / Android versionCode 119）；夜间审查：**无阻断性新 bug**。
- iOS Maestro 默认冒烟 + 扩展项 PASS；Android Pixel 完整 7 项 PASS（见 `docs/overnight-optimization-2026-08-27.md`）。
- 可还原 App 快照：`.snapshots/`（如 `askbible-app-2026-08-26-0142`）；说明见同目录 `RESTORE.txt`。

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
