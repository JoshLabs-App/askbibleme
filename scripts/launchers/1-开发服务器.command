#!/bin/bash
# 双击：在终端里启动 Studio 开发服务器（端口 3450）
# 首次若被 macOS 拦截：右键 → 打开

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Selah.my Studio · 开发服务器"
echo "  目录: $ROOT"
echo "  浏览器打开: http://localhost:3450/studio"
echo "  停止: 在本窗口按 Control+C"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exec npm run dev
