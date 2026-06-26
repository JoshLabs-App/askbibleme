# AskBible.me Mobile 1.0.7 (63)

双端统一版本：**1.0.7**，构建号：**63**。

---

## 简体中文（App Store / Google Play）

**本次更新**

- **今日计划朗读可续播**：播放今日读经计划时，若暂停、切到后台或关闭 App，同一天再次点播放会从上次章节与进度继续，无需从头开始。
- **朗读更稳定**：修复首页播放后暂停可能引起的页面跳动；改进播放中断后的恢复逻辑。
- **阅读体验**：优化章页切换时的背景显示，减少闪黑。

---

## English

**What's New**

- **Resume today's reading plan**: If you pause, background the app, or close it while listening to today's plan, tapping play again the same day continues from your last chapter and position.
- **Smoother audio playback**: Fixes page flicker after pausing from the home screen; more reliable recovery after interruptions.
- **Reading polish**: Reduces black flashes when switching chapters.

---

## 内部备注

- 构建：`npm run mobile:build:ios:production` / `mobile:build:android:production`
- 版本同步：`npm run mobile:bump:store-version -- 1.0.7 63`
- 已提交：Play internal + alpha；TestFlight build 63（外部 Beta 审核）
