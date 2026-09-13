# 01AskBible · 决定记录

讨论中一达成共识就当场写在这里，不要攒到收尾。每条三行：决定了什么 / 为什么 / 日期。
推翻的标「已作废 + 日期 + 新决定在哪」，不要删。

## 决定

### 圣经目录书卷行不放行尾「›」
- **决定了什么**：原生 iOS / Android 的圣经目录，每一行书卷右侧的「›」箭头去掉，行内只留编号 + 书名。
- **为什么**：Josh 2026-09-11 看 iOS 截图直接指出不要这个箭头；整行本来就可点，箭头只是视觉噪音。RN 版（askbible-mobile）暂未同步，见 OPEN-ITEMS。
- **日期**：2026-09-11

### 底栏 Tab 按钮补 contentShape
- **决定了什么**：`ShellTabBar` 的四个 Tab 按钮加 `.contentShape(Rectangle())`，整块 52pt 高的区域都可点。
- **为什么**：SwiftUI 的 plain Button 只把字形笔画当命中区，图标空心处点不动，实测底栏切不了页。同 project_ios_tap_targets 记的那条坑。
- **日期**：2026-09-11

### 人物锚点像用 ChatGPT 网页版出图，不走 API
- **决定了什么**：圣经人物透明底立绘沿用《01AI 短剧》那套「内置浏览器驱动 ChatGPT 网页版 → 会话接口配对 → 页内 fetch 取原图」流程（`~/Desktop/APP/01AI 短剧/docs/CHATGPT-出图流程.md`），**不调图像 API**。风格锁复用 `lib/figures/scene-style-guide.ts` 里的 `CHARACTER_PORTRAIT_STYLE_PROMPT`。
- **为什么**：Josh 2026-09-11 明确「不是要 API 来跑」；网页版是登录态、零额外成本，且 AI 短剧线程已实跑验证批量发批量取可行。
- **日期**：2026-09-11

### 第一批只做 12 个核心人物 × 1 张成年像
- **决定了什么**：人物库 104 个 profile 里，先给 `importanceTier == "core"` 的 12 人各生成 1 张成年期透明底立绘；少年大卫、老年摩西这类多阶段等真要用时再补。
- **为什么**：Josh 2026-09-11 选的范围。量小先验证风格一致性，跑通再扩到 88 个主人物。
- **日期**：2026-09-11

### 人物立绘的出图规则（ChatGPT 会话内约定）
- **决定了什么**：只报人物名，不喂长提示词——ChatGPT 会自己扩写。会话里已立三条硬规则：每个人物必须重新设计骨相、不得沿用上一张的脸；不要人人都持道具、不要都做邀请手势；站位方向按各人身份不同。骨相备份写在 `data/figure-visual-profiles/bundle.json` 的 `facialStructureZh`，出图时不必发。
- **为什么**：Josh 2026-09-11 实测，给参考图会把脸整个抄过去；长提示词反而不如让 ChatGPT 自己扩写。
- **日期**：2026-09-11

### 人物 slug 统一到人物库
- **决定了什么**：`data/figure-visual-profiles/bundle.json` 与 `data/scripture/scene-illustrations/GEN-33.json` 的 slug 改用人物库口径（`jacob-patriarch` / `figure-esau` / `figure-leah` / `figure-rachel` / `joseph-genesis`），参考图文件名同步改名。
- **为什么**：原来视觉库用 `jacob`、人物库用 `jacob-patriarch`，两套对不上，以后按 slug 关联会断。
- **日期**：2026-09-11

### 人物立绘定版为「圣经人物博物馆系列」标准
- **决定了什么**：人物立绘的风格、构图、透明底、眼神、动作、骨相、服饰七条规则整理成一份标准，存 `docs/figure-portrait-standard.md`，含可直接复用的底层模板。以后出图只报人物名 + 时期。
- **为什么**：Josh 2026-09-11 在 ChatGPT 会话里逐轮调教后定版，避免每次重新讨论风格、避免所有人一张脸一个姿势。
- **日期**：2026-09-11

### 省积分写进开发规则
- **决定了什么**：`~/Desktop/APP/CLAUDE.md` 第六节扩成三块——日常习惯、按单价排序的替代做法表、必须主动提醒的时机清单。对所有项目生效。
- **为什么**：Josh 2026-09-11「减少烧积分也要定入开发，及时提醒」。这轮出图早期用截图轮询进度白烧了一大截，换成查 DOM 状态标志后每轮只剩几十 token。
- **日期**：2026-09-11

### 出图改为每条都带完整风格前缀
- **决定了什么**：不再只报人物名。每一条都发 Josh 定版的「统一系列风格」整段前缀，末尾加人物名 + 时期。前缀逐字存在 `docs/figure-portrait-standard.md` 末节。
- **为什么**：只报名字时会话被前面的图带偏——风格漂成真人写实，透明底变成画上去的棋盘格。前缀把这两个坑写死了。这条推翻了本文件上面「只报人物名」那条。
- **日期**：2026-09-11

### iOS 真机安装改用 CLI，不再开 Xcode GUI

- **决定了什么**：安装新版到 iPhone 全程用 `xcodebuild` + `xcrun devicectl` CLI 完成，不需要打开 Xcode GUI。跟 Claude 说「装到 home 手机」或「装到 David 手机」即可，自动编译并安装。
- **为什么**：之前每次要手动打开 Xcode、选设备、点 Run；CLI 更快且可自动化。根本原因是 `DEVELOPMENT_TEAM = AJ2998VZH6` 之前只存在 Xcode 用户缓存里（不进 git），今天已写入 `apps/askbible-ios/AskBible.xcodeproj/project.pbxproj`，CLI 和 GUI 都能直接读到。
- **不会被清理掉的理由**：清理脚本只扫 `~/Desktop/APP` 下的 `dist/build/.next/DerivedData` 等目录，不碰 `~/Library/`（证书、Provisioning Profiles 在这里）；pbxproj 已提交进 git，不会丢。
- **每次安装必须先卸载**：覆盖安装会导致容器状态脏，App 启动 0.4 秒被 SIGKILL，无崩溃报告。流程固定为：卸载 → 编译 → 安装。卸载会清本地登录，需重新登录一次。
- **设备 UDID**：home 手机 `00008101-001641020C98001E`，David iPhone `00008120-0002598A0244C01E`。
- **日期**：2026-09-13

### Android 包体压缩：音乐 + info-edition + 自然场景视频改为按需下载

- **决定了什么**：三类大文件不再随安装包内置，全部改为按需从 R2 流播或下载：
  1. **音乐 MP3（68MB）**：5 首 starter tracks 删出 assets，MusicCatalog 所有 164 首 `bundled: false`，ExoPlayer 走 R2 HTTPS 流播。
  2. **info-edition.sqlite（26MB）**：上传到 R2 `bible/info-edition.sqlite`，新增 `InfoEditionDownloader`，首次点击「陪你探索 / 查找资料」时异步下载，UI 显示「首次加载中」进度条，下载完成自动显示内容。
  3. **自然场景视频（9.7MB）**：只保留默认景（雪山湖）内置，其余 8 景走 R2 HTTPS 流播（ExoPlayer / AVPlayer 原生支持）。
- **为什么**：Josh 确认。Android 安装包从约 92MB 压到约 24MB（-68MB）。
- **日期**：2026-09-13

## 已作废
