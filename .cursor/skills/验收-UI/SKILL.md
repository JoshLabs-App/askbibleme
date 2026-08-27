---
name: verify-ui
description: >-
  AskBible 移动端 UI 改动验收。改 apps/askbible-mobile 界面、布局、交互、底栏、抽屉、Explore/Read/Home 屏后使用。
  强制：按 Feature Map 进屏 → 模拟器/真机看效果 → 截图或说明未验证项。简写：验收-UI。
---

# 验收 · UI（移动端）

改完 UI **不算完成**，直到走完下列闭环（或明确写出无法验证的原因）。

## 必做

1. 读进屏路径：`docs/mobile-feature-map.md`，定位受影响屏。
2. 用 Feature Map 的**用户路径**进入该屏（不要只打开孤立路由猜）。
3. 在模拟器或真机验证（默认 **iOS 优先**；若改了 Android 专属再验 Android）：
   - 目标控件可见、可点
   - 布局无严重裁切 / 重叠
   - 深色或羊皮卷背景下可读
4. 有条件时截图对照；无模拟器时在回复里写清：**未做设备验证** + 建议用户看哪一屏。
5. **壳层 / Explore 相关 UI**：模拟器已装 Debug 时跑 `npm run mobile:maestro:smoke`（见 `docs/mobile-maestro-auto-merge.md`）。不能跑则说明原因。

## 禁止当作「已验收」

- 仅 `tsc` / lint / unit test 通过
- 仅读代码断言「应该没问题」
- 改了 A 屏却只打开了无关的 B 屏

## 合入

- UI 冒烟过后再开 PR；需要自动合入时用 `npm run pr:auto-merge`（标签 `auto-merge` + CI 绿）。**禁止**无门禁直推 `main`。
