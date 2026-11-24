# AskBible.me · 拆巨石接线图（接口契约先行）

> 全仓 >1000 行巨石源码按「先立接口契约、再单块搬家、严禁反向依赖」拆解，主组件只做状态总线与插座挂接。
> 铁律：每次拆一块 → `npm run map` + `npx tsc --noEmit` + `npm test` 通过 → 精准 `git add` 提交。

## 1. 全仓 >1000 行巨石清单与拆解顺序（从高频Web核心到工作台与原生壳）

| 序 | 巨石文件（初始行数） | 目标水位 | 子模块落位目录与核心拆分块 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `components/music/MusicShellPlaybackContext.tsx`（1643 行） | ≤ 550 行（现 513 行） | `components/music/music-shell-playback-types.ts`（类型与 URL 工具）<br>`use-music-shell-sleep-and-hooks.ts`（定时停止 & 播放前后钩子）<br>`use-music-shell-persistence.ts`（曲库刷新 & 进度持久化恢复）<br>`use-music-shell-audio-events.ts`（听读计时 XP & `<audio>` 事件预取）<br>`use-music-shell-scripture-and-ended.ts`（曲末自动续播 & 经文/音乐切换）<br>`use-music-shell-media-session.ts`（Web MediaSession 锁屏线控同步） | ✅ 已完成（-1130 行） |
| **2** | `components/bible/ReadChapterVersesClient.tsx`（1172 行） | ≤ 550 行 | `components/bible/read-chapter-verse-long-press.ts`（长按手势 hook）<br>`ReadChapterInlineVerseChunk.tsx`（行内经文片段渲染）<br>`ReadChapterVerseParagraph.tsx`（段落双语对照与高亮渲染） | 待拆 |
| **3** | `components/nature/NatureVideoExperience.tsx`（1197 行） | ≤ 550 行 | `components/nature/use-nature-scene-rotation.ts`（场景轮播与全量缓冲）<br>`use-nature-chrome-autohide.ts`（顶底壳层显隐与等待提示）<br>`NatureVerseOverlay.tsx`（金句字号自适应压缩排版层） | 待拆 |
| **4** | `app/studio/studio-ai-discussion-panel.tsx`（1362 行） | ≤ 550 行 | `app/studio/studio-discussion-storage.ts`（信封解析、裁剪与落盘头）<br>`studio-discussion-badges.ts`（深度反思与角色徽章格式化）<br>`StudioDiscussionMessageList.tsx`（消息流 Markdown 渲染） | 待拆 |
| **5** | `app/studio/studio-workspace.tsx`（1284 行） | ≤ 550 行 | `app/studio/use-studio-pane-layout.ts`（三栏拖拽尺寸持久化）<br>`use-studio-doc-editor.ts`（文档读取、保存与历史回滚）<br>`StudioContextSidebar.tsx`（左栏原则文档导航树） | 待拆 |
| **6** | `apps/askbible-android/.../MainActivity.kt`（1435 行）<br>`apps/askbible-ios/AskBible/AskBibleApp.swift`（1236 行） | ≤ 650 行 | 按 D-44 极薄原生底座原则，将 WebView 桥接消息分发（`NativeMediaBridge`）与底栏/抽屉壳层 UI 拆分为独立平级文件，严守三路音频状态机单点真源 | 待拆 |
| **7** | `lib/explore/years-days-eternity-content.ts`（1131 行） | 按章分片 | 纯静态长文常量表（无状态逻辑），仅在扩编内容时按章节拆入子目录聚合导出 | 静态豁免 |

## 2. 首块巨石 `MusicShellPlaybackContext.tsx` 拆解接口契约

1. **对外导出零变更**：`MusicShellPlaybackProvider`、`useMusicShellPlayback`、`MusicShellPlaybackValue`、`ScriptureAudioRepeatMode`、`MusicShellSleepTimerMinutes`、`DeviceLibraryPlaybackInfo` 签名与字段名 100% 原样保留，全仓 22 处调用方零改动。
2. **单向依赖铁律（水只往下流）**：
   - 底层：`music-shell-playback-types.ts`（纯类型 + 纯函数，零 React 组件依赖）。
   - 中层：`use-music-shell-*.ts`（5 个专项 Hook，仅依赖 `music-shell-playback-types.ts` 与 `@/lib/*` / `@/hooks/*`）。
   - 顶层：`MusicShellPlaybackContext.tsx`（组装 5 个专项 Hook + `<audio>` DOM 源绑定 `useLayoutEffect` + Context Provider）。
   - **严禁**任何子模块反向 `import` `MusicShellPlaybackContext.tsx`。
3. **播放行为硬约束（对齐 `AGENTS.md`）**：
   - 首页 `/`、`/nature` 首屏未激活（`!shellAudioHomePrimed`）前严禁向隐藏 `<audio>` 绑定 `src` 抢占内存。
   - 听读计时严格按媒体 `currentTime` 增量（`0 < delta < 2`）满 15 秒记片，切源或后台立即停计。
   - 读经计划流（`planFlow`）、灵修音频交接（`shouldHandoffDevotional`）、CUV 单章/本卷循环及「安静」默认曲池互斥复位逻辑逐行等价搬迁。
