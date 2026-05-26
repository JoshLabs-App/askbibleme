#!/bin/bash
# 双击：清缓存起 Metro + 提示 Wi‑Fi 地址；插 USB 时会自动帮手机重连
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
bash "$HERE/reconnect-android-wifi.sh"
echo ""
read -r -p "按回车关闭此窗口…" _
