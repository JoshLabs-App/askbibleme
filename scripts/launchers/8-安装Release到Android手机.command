#!/bin/bash
# 双击：打 Release APK（资源全打进包）并 adb 安装；不用 Metro / 本机 API
# 终端等价：npm run mobile:install:apk:device

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
exec bash "$HERE/install-mobile-apk-to-device.sh"
