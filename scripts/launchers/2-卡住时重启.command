#!/bin/bash
# 双击：结束占用 3450 的旧进程，清理缓存后重新启动（页面/chunk 异常时用）
# 首次若被 macOS 拦截：右键 → 打开

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Selah.my Studio · 干净重启"
echo "  目录: $ROOT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exec npm run dev:restart
