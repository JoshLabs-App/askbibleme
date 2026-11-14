# AskBible 进度总览（2026-10-29，改回本机开发时整理）

## 本机仓库状态
- `main` 已快进到 `origin/main`（c181400c，含 PR #16、#17）。
- 原来的未提交改动都保留了。`docs/OPEN-ITEMS.md` 和新拉的内容冲突，两边都是新增条目，已全部保留（O-36 + O-35 等）。
- 没合并的工作分支都建到了本机：`claude/android-prev-chapter-button-8ceuoz`（PR #15）、`fix/android-bg-chapter-advance`（PR #13）、`claude/homepage-quote-repeat-bug-yyweb9`、`claude/install-home-mobile-dg7wo2`。
- 本机未提交改动：安卓 `MainActivity.kt` / `ChapterAudioPlayer.kt` / `ChapterScreen.kt`、iOS `AskBibleApp.swift`（关屏自动跳章，看着和 PR #13 是同一件事），另外还有几份文档和两份故事稿（`docs/story-scripts/`）。

## 已完成（已合进 main）
- PR #17：首页上下滑动切换场景（安卓 + iOS），版本升到 iOS 1.1.5 (136) / 安卓 1.0.51 (248)。
- PR #16：「更多 App」，App 内列出同系列软件，官网换成诗歌（D-42）。
- PR #14 robots 挡 ShapBot；#12 网页选章弹窗滑动不误关；#11 iOS 设置菜单羊皮卷底 + 发版 1.1.4 / 1.0.50；#10 撤回归卡；#9 联系邮箱统一。

## 进行中 / 卡住
1. **1.1.5 / 1.0.51 发版没发出去**：代码已合并，iOS 包编好了，但上传 App Store、官网下载页、Play 三步被 Mac 上的发版权限规则拦了（线程「首屏上下滑动切换场景」，10-23 停在这）。
2. **PR #15（草稿）**：安卓播放栏上一章 + 原生谷歌登录 + 读经不飘分不振动，已装三星。等你试谷歌登录；Google Cloud 可能还要补安卓 OAuth 客户端（O-35）。
3. **PR #13（开着）**：关屏后每日读经自动连读下一章（安卓 + iOS）。
4. 旧分支 `homepage-quote-repeat-bug`（9-13，安卓金句重复播）、`install-home-mobile`（PWA 加主屏，已自己 revert），要不要留待定。

## 下一步（建议顺序）
1. 放行发版权限，或在终端自己跑，把 1.1.5 / 1.0.51 三端发出去。
2. 试 PR #15 的谷歌登录 → 能用就合并。
3. 本机未提交的跳章改动和 PR #13 对一下，统一成一份再合并。
4. O-36：TovCore iOS 过审后补链接；三星装「更多 App」看一眼。
5. 本机 `.env.local` 软链断了（指向的 00 里那份丢了），要从 Vercel 恢复。

## 待你决定
- 发版：放行权限还是自己跑？
- 两条 9 月的旧分支删不删？
- `.env.local` 要不要从 Vercel 恢复？
