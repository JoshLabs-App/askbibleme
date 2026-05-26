#!/bin/bash
# 双击：USB 安装 iPhone 独立 Release 包（离线可用，无需 Metro；需 Xcode / 开发者证书）
# 终端等价：npm run mobile:ios:device  或  npm run mobile:dev:iphone
# Metro 热更新开发：npm run mobile:ios:device:metro
# 不连 Mac 数据线装 iOS：npm run mobile:build:ios:internal（EAS 云端）

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
exec bash "$HERE/run-mobile-ios-device.sh"
