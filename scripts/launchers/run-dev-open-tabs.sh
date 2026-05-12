#!/usr/bin/env bash
# 供「1-开发服务器」「2-卡住时重启」调用：后台启动 Next，待 3450 可访问后打开前台首页与 Admin。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

MODE="${1:-dev}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$MODE" = "restart" ]; then
  echo "  Selah.my · 干净重启开发服务器"
else
  echo "  Selah.my · 开发服务器"
fi
echo "  目录: $ROOT"
echo "  就绪后将打开浏览器：前台 http://localhost:3450/ ，后台 http://localhost:3450/admin"
echo "  停止: 在本窗口按 Control+C"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$MODE" = "restart" ]; then
  npm run dev:restart &
else
  npm run dev &
fi
DEV_PID=$!

trap 'echo ""; echo "正在停止开发服务器…"; kill "$DEV_PID" 2>/dev/null || true; wait "$DEV_PID" 2>/dev/null || true; exit 130' INT TERM

READY=0
# 最多等待约 2 分钟（首次编译较慢）
for _ in $(seq 1 120); do
  if curl -sf -o /dev/null "http://127.0.0.1:3450/"; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -eq 1 ]; then
  echo ""
  echo "→ 正在打开浏览器（前台 + 后台）…"
  open "http://localhost:3450/"
  open "http://localhost:3450/admin"
  echo ""
else
  echo ""
  echo "⚠ 3450 端口在超时内未就绪，未自动打开浏览器；请就绪后手动访问上述地址。"
  echo ""
fi

wait "$DEV_PID"
