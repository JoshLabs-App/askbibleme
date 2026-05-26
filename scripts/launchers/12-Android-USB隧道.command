#!/bin/bash
# 双击：Wi‑Fi 访问不了 8081 时，USB 转发 + 用 127.0.0.1 连 Metro/API
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
bash "$HERE/reconnect-android-usb-reverse.sh"
echo ""
read -r -p "按回车关闭此窗口…" _
