# AskBible 移动端夜间全面审查报告

**日期**：2026-08-27（美东）  
**设备**：iPhone 17 Pro 模拟器（iOS 26.5）+ Pixel 一代 `192.168.1.5:5555`（Android，v1.0.38）  
**范围**：Feature Map 全路径 Maestro 冒烟、代码审查、性能/流畅度优化、死代码清理

---

## 一、测试结果总览

### ✅ 已通过

| 平台 | 套件 | 结果 |
|------|------|------|
| **iOS** | 默认冒烟 `.maestro/smoke-shell.yaml` | PASS（改代码后复跑 PASS） |
| **iOS** | 扩展 5 项（routes / tab-bar / bookmark / music-repeat / home-settings） | 5/5 PASS |
| **Android Pixel** | 完整 7 项（`maestro-run-android-full.sh`） | **7/7 PASS** |
| **单元测试** | `scripturePlayChapterAt` + `scripture-chapter-pool` | 8/8 PASS |

### Android 完整套件明细

1. `smoke-shell` — PASS  
2. `ios-smoke-routes` — PASS（13 条 deep link 路由）  
3. `ios-smoke-deep-routes` — PASS（figures detail + birth-settings）  
4. `ios-sync-data-smoke` — PASS（抽屉 / 收藏 / 计划截图）  
5. `ios-music-repeat` — PASS（循环模式切换）  
6. `ios-bookmark-double-tap-sync` — PASS（双击收藏 → 收藏页同步）  
7. `ios-read-mat13-play-audio` — PASS（MAT/13 章音频 FAB）

### ⚠️ 已知警告（非失败）

- `ios-sync-data-smoke` / `ios-music-repeat` 在 Android 上 Skip/略过 按钮未找到 — **Optional 步骤**，已 WARN 后继续，不影响 PASS。
- 默认冒烟只覆盖 Feature Map 约 **15–20%**；完整本地库约 **45–55%**（见下文缺口清单）。

---

## 二、已完成的代码优化（本夜已改）

### P1 · 性能 / 流畅度

| 改动 | 文件 | 预期收益 |
|------|------|----------|
| **生产环境关闭章加载日志** | `loadReadChapterScreenChapter.ts` | 每次开章不再 `console.warn` 3 次，减少主线程 I/O |
| **Android 经节 stable key** | `ReadChapterScreenVerseList.tsx` | 朗读高亮 / 选中 / 收藏时不再整段 remount，Android 章页滚动与音频同步更顺 |
| **章页脱离 Music Context 订阅** | `ReadChapterScreen.tsx` + `musicPlaybackControlSnapshot.ts` | 音乐进度 250ms tick 不再触发整章重渲染 |
| **今日读经：并行加载 + 先导航** | `startTodayReadingScriptureFromReadHome.ts` | payload / audioPrefs / resume 并行 `Promise.all`；算好目标章后立即 push，再后台建池开播 |
| **Explore 栈 freezeOnBlur** | `app/(tabs)/explore/_layout.tsx` | 离开 Explore 深页后冻结 JS，减 Android 后台卡顿与内存 |
| **音乐预加载日志仅 DEV** | `useMusicDefaultTrackPreload.ts` | 冷启动少生产 warn |

### P2 · 代码精简

| 改动 | 说明 |
|------|------|
| 删除 `useHomeFullBleedFrame.ts` | 零引用 deprecated re-export |
| 新建 `nativeMaskedViewAvailable.ts` | 4 处重复逻辑合并（EdgeFade ×2、Parchment、ExploreScripture） |

**净变更**：约 +86 / −87 行（17 文件），无新依赖。

---

## 三、Maestro 覆盖缺口（建议下一步）

当前 **27 条** Maestro flow，默认 CI/Agent 只跑 **1 条**。

### 未覆盖的高价值路径

| 功能 | 风险 | 建议 |
|------|------|------|
| **四 Tab 真点击**（Music / Explore） | 仅 deep link，坐标未在 Android 校验 | 新增 `smoke-tab-all-four.yaml` |
| **中间计划 FAB** → `/read/plan-play` | 从未自动化 | 新增 `smoke-plan-fab.yaml` |
| **Reading planner 向导** | 多步流程零覆盖 | 新增 `smoke-explore-planner-entry.yaml` |
| **Home 金句点击 → 章页** | 核心路径 | 新增 `smoke-golden-verse-tap.yaml` |
| **抽屉打开**（Locale / 版本） | 仅 sync-smoke 顺带 | 可并入 Tier A |
| **Welcome 冷启动** | prep 跳过 | 单独 weekly flow |
| **Golden verse R2 音频** | 需网络 + 播放断言 | 手动 / 真机 weekly |
| **Reading alarm 触发 overlay** | 仅打开设置页 | 需 `dev/reading-alarm` Maestro 包装 |
| **OAuth Google（Android 浏览器）** | 8 条 flow 均 credential 依赖 | weekly + Pixel 真机 |
| **Apple Sign-In** | iOS only | 保留 pre-release |

### 建议接线

```bash
# 建议新增 npm script（尚未实现，可 morning 加）
npm run mobile:maestro:overnight
# → iOS + Android 各跑 Tier A 六项（见 mobile-maestro-auto-merge.md）
```

Tier A 六项（credential-free，约 20–40 min/平台）：

1. `smoke-shell`
2. `ios-smoke-routes`
3. `ios-tab-bar-home-read`
4. `ios-bookmark-double-tap-sync`
5. `ios-music-repeat`
6. `ios-home-settings-panel-parchment`

---

## 四、审查发现 · 待办 backlog（未改，按优先级）

### P1 · 建议近期做

| 项 | 位置 | 说明 |
|----|------|------|
| 音乐 bootstrap 多次 setStore | `useMusicStoreBootstrap.ts` | 冷启动 5 次 store 更新 → 可合并为每阶段一次 |
| 金句音频 900ms 轮询 | `useHomeNatureVerseAudioPlayback.ts:1073` | 改 `onPlaybackStatusUpdate` 事件驱动 |
| Read 栈 search/favorites freezeOnBlur | `app/(tabs)/read/_layout.tsx` | 评论称章页外 route 仍吃 JS |
| 启动 shellFeaturesReady 900ms 延迟 | `app/_layout.tsx:204` | 可拆轻量 shell 先挂载 |
| Home 视频双 gate | `useHomeNatureScreenLoad.ts:229` | Android 240ms + iOS 480ms + ensureBootVideo 叠加 |

### P2 · 可 incremental

| 项 | 说明 |
|----|------|
| `ParagraphVerseFlowBlock` vs `ReadChapterScreenVerseRow` 重复 | 提取 shared verse chunk |
| `startTodayPlanFlowScripture` vs read-home 重复 payload 准备 | 合并 `prepareTodayPlanFlow()` |
| `journey` hidden tab 无路由 | 删 tab 或加 stub |
| `@deprecated getActiveReadChapterPlayback` | 6+ 调用方迁移到 `resolveTransportReadChapterPlayback` |
| Android search 无 edge fade | `ReadScriptureSearchScreen.tsx:223` maskEnabled=false |
| R2 音乐/金句 TEMPORARY | 产品决策，待 PAD/本地迁移 |

### P0 · 无新发现

本夜测试与审查**未发现阻断性 bug**；iOS 1.0.38 已提审上传、Android production 已 submit（见终端 `839871.txt` 成功日志）。

---

## 五、平台对齐状态

| 维度 | iOS | Android Pixel | 备注 |
|------|-----|---------------|------|
| 壳层四 Tab + deep link | ✅ | ✅ | Tab 坐标 Android 未单独校准 |
| Read 章 / 收藏 / 计划 | ✅ | ✅ | |
| Explore 瓦片路由 | ✅ | ✅ | |
| Music 循环 / 设置面板 | ✅ | ✅ | |
| 章音频 FAB | ✅ | ✅ | MAT/13 |
| OAuth | 手动 flow 存在 | 浏览器路径未本夜跑 | |
| Apple Sign-In | N/A | N/A | iOS only |

---

## 六、Morning 建议动作

1. **真机 spot-check**（5 min）：Pixel 上从 Read 首页点「今日读经」— 应更快进入章页（本夜优化）。
2. **Android 章页朗读**：开 MAT/13 或 GEN/1 播放，观察高亮是否不再闪跳（key 修复）。
3. **Explore 深导航后切 Tab**：确认 freezeOnBlur 无功能回归（reading-planner 仍 `freezeOnBlur: false`）。
4. **若满意**：`git add` 本报告 + mobile 改动 → 开 PR → `npm run pr:auto-merge`。
5. **可选**：实现 Tier A `mobile:maestro:overnight` script + Tier B 新 flow（见第三节）。

---

## 七、改动文件清单

```
apps/askbible-mobile/app/(tabs)/explore/_layout.tsx
apps/askbible-mobile/src/explore/ExploreScriptureFadeScroll.tsx
apps/askbible-mobile/src/home/useHomeFullBleedFrame.ts          [deleted]
apps/askbible-mobile/src/music/musicPlaybackControlSnapshot.ts
apps/askbible-mobile/src/music/useMusicDefaultTrackPreload.ts
apps/askbible-mobile/src/music/useMusicPlaybackProvider.ts
apps/askbible-mobile/src/read/ParchmentBottomFadeScrollView.tsx
apps/askbible-mobile/src/read/ReadChapterScreen.tsx
apps/askbible-mobile/src/read/ReadChapterScreenVerseList.tsx
apps/askbible-mobile/src/read/loadReadChapterScreenChapter.ts
apps/askbible-mobile/src/read/startTodayReadingScriptureFromReadHome.ts
apps/askbible-mobile/src/ui/EdgeFadeHorizontalScrollView.tsx
apps/askbible-mobile/src/ui/EdgeFadeScrollView.tsx
apps/askbible-mobile/src/ui/nativeMaskedViewAvailable.ts         [new]
docs/overnight-optimization-2026-08-27.md                        [new]
```

---

*本报告由夜间 Agent 自动生成；测试日志：`/tmp/askbible-maestro-ios-smoke.log`、`/tmp/askbible-maestro-android-full.log`*
