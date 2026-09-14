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

### Solid Joys 不自己翻译、不自己配音，也不抓站
- **决定了什么**：在 Desiring God 另行书面同意之前，Solid Joys 只用八福伙伴现成的中文译文和音频。不自行翻译、不用 TTS 生成朗读，也不去八福伙伴站点或公众号批量抓取。
- **为什么**：DG 2026-09-10 回复明确写了不授权新译和新录音，TTS 朗读同样算新录音。八福伙伴官网本身没有每日灵修正文，内容只在微信公众号和福源课堂。详见 `docs/content-permissions.md`。
- **日期**：2026-09-14

### 再给 Desiring God 回一封信，三件事合并成一封
- **决定了什么**：在原邮件串里回复，一次问三件事：请 DG 提供或牵线取得八福伙伴中文版文件并确认授权是否已覆盖；请求重新考虑授权翻译现行版；新申请 John Piper 讲道的中文翻译配音。草稿由 Claude 起草，Josh 自己从 Gmail 发。
- **为什么**：八福伙伴没有邮箱、官网打不开，找 DG 最省事；新译请求刚被拒过，所以写成附带审核条件的重新考虑请求，而不是直接要英文文本。
- **日期**：2026-09-14

## 已作废

### 划重点灵敏度修复（2026-09-13）
- **决定**：修复划重点 pan 手势漏字问题，不删除功能。
- **为什么**：根因是 `paintAt` 每次只标当前触点的 1 个字符，手指快划时两次回调之间的字符被跳过。基础设施（TextKit 绘制、存储、会员同步、HighlightBar UI）已全齐，修复成本低（约 20 行），删除浪费。
- **修法（最终 Fix 5）**：去掉 pan gesture，改用 `FlowTextView.touchesBegan/Moved/Ended` 直接接触摸。`prevPaintIdx` 填补连续区间；`pendingPaints`+`liveHighlightRuns` 在手势结束前仅在本地绘制预览，结束时批量提交 `onPaint`（消除每字符 SwiftUI 刷新的卡顿）；`setParentScrollEnabled` 同时设 `delaysContentTouches = false`，阻止 ScrollView 抢触摸。
- **验证**：2026-09-13 安装真机验收通过，丝滑连续。
- **日期**：2026-09-13

### 划重点两个 bug 修复（2026-09-13 真机复验通过）

**Bug 1：黄色落不下来（persistence 断链）**
- **根因**：加节号高亮支持时把 `textStarts = built.textRanges` 改成了 `built.ranges`（含节号），导致 `paintAt` 里算出的字符下标与 `VerseHighlightStore` 存储格式错位，`runs()` 找不到对应区间，`highlightRuns` 始终为空。
- **修法**：`textStarts = built.textRanges`，`textOffsets = [:]`，回到 Fix 5 坐标映射。节号视觉高亮靠 `runs()` 里 `runStart == 0 → fullStart` 的扩展逻辑处理，不需要在 `paintAt` 里覆盖节号区。
- **日期**：2026-09-13

**Bug 2：下部分选不了（touch blocking）**
- **根因**：`ParchmentCardModifier` 的 background 内部有一张 `UIScreen.main.bounds.height` 高的羊皮纸图，该背景视图会截获 SwiftUI 触点，使底部 ~8 行文字区域的触点无法到达 UIKit 层的 `PaintGestureRecognizer`。
- **修法**：`ParchmentCardModifier` 加 `backgroundHitTesting: Bool = true` 参数；HighlightBar 传 `backgroundHitTesting: false`，背景 `.allowsHitTesting(false)` 穿透给下层 FlowTextView；颜色按钮 / 完成按钮作为前景元素不受影响，仍可点击。
- **日期**：2026-09-13

## 划重点同步改为整份「后改的为准」（2026-09-14，安卓原生）
- **决定**：`highlights` blob 不再逐字取并集，整份以 updatedAt 新的一侧为准；updatedAt 用本机最后一次划/擦的时间，擦空也上传；本机有未同步的擦除时算「有进度」，不走只拉云端。
- **为什么**：并集下擦掉的字会被云端旧副本补回（Josh 反馈清除后自动恢复）。代价：两台设备同时离线各自划，后同步的一方覆盖先前的。
