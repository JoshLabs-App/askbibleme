---
name: verify-oauth
description: >-
  AskBible 登录 / OAuth / 回调改动验收。改 login、register、Google/Apple Sign-In、auth session、
  深链回调、MemberLogin 时使用。强制先确认回调终点再改代码。简写：验收-OAuth。
---

# 验收 · OAuth / 登录

## 改之前（强制）

先书面确认三点，再动代码：

1. **登录承载端**：App 内 / 网页？
2. **回调终点**：必须回 App，还是允许网页 HTTPS 完成？
3. **参考实现**：仓库里现有 `googleSignIn` / `appleSignIn` / login 路由怎么走？

默认：**从 App 发起的登录必须回到 App**。  
仅当用户明确要求「网页完成登录」时，才可启用网页 HTTPS 回调。

## 改之后

| 检查 | 通过标准 |
|------|----------|
| 入口 | 抽屉 / Explore 问候 / Welcome 仍能进 `/login` `/register`（见 Feature Map） |
| Google | 未把 App 回调悄悄换成仅网页；Android 浏览器 OAuth 若保留，成功后仍回 App |
| Apple | 仍为 **iOS only**；Android 不出现坏掉的按钮 |
| 成功路径 | session 写入；welcome gate 可清；落到 `/` |
| 失败路径 | 取消 / 失败有可见反馈，不卡死白屏 |

## 禁止

- 因「网页回调好测」就替换 App 回调
- 未确认终点就改 redirect URI / scheme
- 只改一端（iOS 或 Android）却声称全端完成

进屏路径：`docs/mobile-feature-map.md` → Login / OAuth。
