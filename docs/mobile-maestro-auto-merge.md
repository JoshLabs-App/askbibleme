# Maestro + Gated Auto Merge

**你不必记命令**——改 App 时 Cursor Agent 会按 `.cursor/rules/mobile-maestro-auto-merge.mdc` 自动跑验收与 PR 合入门禁。  
人只需：正常让 Agent 改代码；要合 `main` 时说「开 PR / 合进去」即可。

---

## 给创始人：会跑什么 · 意义

**一句话：** 不是让 AI 写更多代码，而是让 AI **自己证明改对了**。

| 跑什么 | 在哪跑 | 何时 | 意义 |
|--------|--------|------|------|
| **Maestro 冒烟** | 本机模拟器 | Agent 改完 App UI / 壳层 / Explore / Read | 真打开 App 走一遍（首页→音乐→读经→读经提醒），不只说 Done |
| **验收 Skill** | Agent 读规则 | 改 OAuth / 媒体 / UI | 回调回 App、R2 不走主站等边界 |
| **Feature Map** | Agent 读文档 | 截图 / 模糊描述定位功能 | 知道「哪个屏、怎么进去」 |
| **CI `build`** | GitHub | 每次 PR / push | 整仓网站 build + 发版 preflight 没被打坏 |
| **Auto Merge** | GitHub | PR 有 `auto-merge` 且 CI 绿 | 有门禁才 squash 进 `main` |

**App 质量** → 靠本机 Maestro。**仓库安全** → 靠 CI + 分支保护。  
Maestro **不在 GitHub Linux 上跑**（要 macOS 模拟器）。

| 你几乎不用管 | 只有这时可能找你 |
|--------------|------------------|
| CI 自动跑、带标签 PR 自动合 | 模拟器没开 / 没装 Debug 包（需本机 `npm run mobile:ios` 装过一次） |

---

最小闭环：**写码 → Maestro 真机路径 → CI 绿 + `auto-merge` 标签 → squash 合 PR**。  
**禁止**无标签 / 无 CI 直推 `main`。

## Maestro（本机）

| 项 | 说明 |
|----|------|
| CLI | `maestro --version`；未装：`curl -Ls "https://get.maestro.mobile.dev" \| bash` |
| 流 | `.maestro/smoke-shell.yaml`（深链导航 + `askbible://dev/maestro-smoke-prep`） |
| 稳定点 | 深链 + 屏上文案 regex（中英）；`testID` 非 Maestro 主选择器 |
| 前置 | 模拟器已装 Debug：`npm run mobile:ios`（或 android） |
| 命令 | `npm run mobile:maestro:smoke` |
| 夜间 Tier A（6 流） | `npm run mobile:maestro:overnight`（iOS 模拟器或 Android 设备；`MAESTRO_PLATFORM=both` 双端） |

进屏路径以 `docs/mobile-feature-map.md` 为准；新冒烟流对齐该图。

## Auto Merge（有门禁）

| 规则 | |
|------|--|
| 标签 | PR 必须带 `auto-merge` |
| CI | `.github/workflows/ci.yml` 成功 |
| 动作 | `.github/workflows/gated-auto-merge.yml`：有标签则武装 `--auto`；CI 成功后再确认 squash |
| 本机 | `npm run pr:auto-merge` 或 `npm run pr:auto-merge -- 123` |
| 不做 | 不 force push；不跳过检查；Maestro 默认只在本机（除非自备 macOS runner） |

### Agent 顺序

1. 改代码  
2. UI 相关 → `npm run mobile:maestro:smoke`  
3. 开 PR（不要直接合 main）  
4. `npm run pr:auto-merge`  
5. 等 CI 绿 → squash 进 main  

### 仓库设置（人做一次）

GitHub → Settings → Branches → `main`：Require status checks，勾选 CI 的 `build`。  
无 branch protection 时，`merge-after-ci` 仍会在 **有标签且 CI 绿** 时 squash merge。
