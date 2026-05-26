#!/bin/bash
# 双击：类型检查 + 正式构建（改代码后确认没有错误）
# 首次若被 macOS 拦截：右键 → 打开

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me Studio · 检查编译"
echo "  目录: $ROOT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

set +e
npm run check
STATUS=$?
set -e

echo ""
if [ "$STATUS" -eq 0 ]; then
  echo "✓ 检查通过。"
else
  echo "✗ 检查未通过，请看上面的报错。"
fi
echo ""
read -r -p "按回车键关闭窗口…" _

exit "$STATUS"
