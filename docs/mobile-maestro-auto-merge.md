# Maestro + Gated Auto Merge

**你不必记命令**——改 App 时 Cursor Agent 会按 `.cursor/rules/mobile-maestro-auto-merge.mdc` 自动跑验收与 PR 合入门禁。  
人只需：正常让 Agent 改代码；要合 `main` 时说「开 PR / 合进去」即可。

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
