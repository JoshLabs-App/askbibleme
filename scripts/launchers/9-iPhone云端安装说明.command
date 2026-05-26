#!/bin/bash
# 双击：在终端显示「不连 Mac 数据线装 iPhone」的步骤（EAS 内测）
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"

cat <<'EOF'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  iPhone 不连 Mac 数据线安装（EAS 云端）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1) 安装并登录 EAS（只需在 Mac 终端执行一次）
   npm install -g eas-cli
   eas login

2) 登记 iPhone（手机 Safari 打开链接，不用插线）
   eas device:create

3) 云端打包（bundled-only 独立包，不用 Metro）
   npm run mobile:build:ios:internal

4) 构建完成后打开 https://expo.dev
   → 你的项目 → 该次 Build → Install（iPhone Safari 安装）

需要：Apple 开发者账号（约 $99/年）

若已用 USB 连 Mac 装独立版，请双击：
  7-手机开发-iPhone真机.command
  或：npm run mobile:ios:device

需要 Metro 热更新开发：npm run mobile:ios:device:metro

EOF
read -r -p "按回车关闭…" _
