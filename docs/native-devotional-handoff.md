# 每日读经后接听今日灵修

2026-11-09：原生 iOS 与 Android 的计划页「今日灵修」卡片新增 **读经后接着听** 开关。默认关闭，选择保存在本机，重启后保留。iOS 同时补齐灵修卡片、正文、音频控制和现有管理员可见范围。

## 行为与边界

- 自然读完当天计划的最后一章后，开关已打开且当前账号/语言可使用灵修时，接着播放当天灵修。
- 暂停、手动下一章、普通整卷播放、浏览其它日期，以及跨过午夜的旧日队列，不触发自动接听。
- 播放期间仅浏览日历不会改变本次队列所属日期。用户另行点播某日时才更新归属。
- 读经和灵修使用不同的播放状态。灵修与读经、金句人声互斥；保留背景音乐压低、睡眠定时与统一锁屏控制。
- 灵修沿用 `SolidJoys` 的中文版内容和 befaithful.net 原始音频；全文仅下载缓存到设备，不打包进应用或提交到公开仓库。
- 现有「中文界面 + 管理员账号」范围保留。本次没有公开灵修，也没有修改生产数据或授权政策。

## 实现入口

- 两端 `PlanDevotionalHandoff`：自然完成、队列末项、今天、偏好、可用范围的判断。
- 两端 `ChapterAudioPlayer`：自然播放结束调用 `onFinished`；手动跳章仍调用 `onSkipNext`。
- iOS `Model/SolidJoys.swift`、`Read/DevotionalView.swift`、`Audio/DevotionalPlayer.swift`。
- Android `ui/DevotionalScreen.kt` 与两端应用壳负责偏好与衔接接线。

## 验证

```sh
# iOS：规则、偏好持久化、真实播放器事件、后台续接、禁用、手动跳章、手动播放、大字/深色 UI。
# Harness 使用实际产品卡片和播放器，短本地经文夹具 + 当天真实灵修音频；不绕过正式应用的权限判断。
DEVOTIONAL_SIM_UDID=<simulator-udid> ./scripts/verify-devotional-handoff.sh

# Android：规则回归与完整原生编译。
cd apps/askbible-android
./gradlew :core:test :app:assembleDebug :app:assembleRelease
```

本次验收在独立工作树完成，排除同目录其他会话的修改：

- iOS 11 条衔接规则、默认关闭和偏好重读通过；XCTest 的真实 AVPlayer 前台/后台衔接、关闭后不接播、手动跳章不接播、手动播放通过。深色和最大辅助字号的卡片已截图检查。
- Android 模拟器实际计划页：默认关闭、点开不误入正文、本机保存、末章自然结束后播放当天灵修、关闭后不接播、手动跳过末章不接播均通过。关屏时末章转到灵修，`dumpsys media_session` 显示 devotional 为 PLAYING，屏幕保持 Asleep。
- 原生 iOS Release 构建、Android Debug/Release 构建通过；会员登录规则 92 条、读经计划 99 条三端对拍通过。
- iOS UI 播放测试使用独立 Harness，不等于正式 App 管理员登录端到端验收。实体 iPhone「home」已解锁，签名 Release 测试版 1.1.8 (141) 已安装并通过进程启动验证。实体 Android 和实体 iPhone 的锁屏衔接尚未验收；商店分发尚未完成。
- 本次是原生功能，没有 Web 部署。商店提审仍须遵循 AGENTS.md 的独立授权要求。
