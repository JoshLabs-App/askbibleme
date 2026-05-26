#!/bin/bash
# 双击：开发版（API + Metro + Debug 安装）。不能离线单独用！
# 要可拔线离线包请用「8-安装Release到Android手机」
# 终端等价：npm run mobile:dev:android:device

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
exec bash "$HERE/run-mobile-android-device.sh"
