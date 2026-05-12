#!/bin/bash
# 双击：释放 3450、清理缓存并重启开发服务器；就绪后自动打开前台与管理后台。
# 首次若被 macOS 拦截：右键 → 打开

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
exec bash "$HERE/run-dev-open-tabs.sh" restart
