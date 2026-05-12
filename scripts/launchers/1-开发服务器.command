#!/bin/bash
# 双击：启动开发服务器（3450），就绪后自动用浏览器打开前台首页与管理后台。
# 首次若被 macOS 拦截：右键 → 打开

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
exec bash "$HERE/run-dev-open-tabs.sh" dev
