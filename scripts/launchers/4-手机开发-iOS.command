#!/bin/bash
# 双击：网站 API (3450) + Expo Metro + iOS 模拟器
# 首次若被 macOS 拦截：右键 → 打开

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
exec bash "$HERE/run-mobile-dev.sh" ios
