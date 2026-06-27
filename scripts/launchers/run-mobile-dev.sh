#!/usr/bin/env bash
# 一键：释放端口 → 同步内容 → ① 网站 API (3450) → ② Expo Metro (8081)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

MODE="${1:-ios}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me · 手机开发（一键）"
echo "  目录: $ROOT"
echo ""
echo "  将依次启动："
echo "    ① npm run dev"
echo "       → 网站 API  http://localhost:3450"
echo "    ② npm run mobile:metro -- --clear"
if [ "$MODE" = "ios" ]; then
  echo "       → Expo Metro http://localhost:8081 + iOS 模拟器"
elif [ "$MODE" = "android" ]; then
  echo "       → Expo Metro http://localhost:8081 + Android"
else
  echo "       → Expo Metro http://localhost:8081（本窗口按 i / a）"
fi
echo ""
echo "  停止: 本窗口 Control+C（同时停网站与 Metro）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "→ 释放端口 3450、8081 …"
node scripts/free-port.mjs 3450
node scripts/free-port.mjs 8081
sleep 1

echo "→ 同步手机经文/文案/曲库 (npm run mobile:sync-content) …"
npm run mobile:sync-content

WEB_LOG="${TMPDIR:-/tmp}/askbible-web-dev.log"
echo ""
echo "→ [1/2] 启动网站 API: npm run dev"
echo "    日志: tail -f $WEB_LOG"
npm run dev >"$WEB_LOG" 2>&1 &
WEB_PID=$!

cleanup() {
  echo ""
  echo "→ 正在停止网站 API (pid $WEB_PID) …"
  kill "$WEB_PID" 2>/dev/null || true
  wait "$WEB_PID" 2>/dev/null || true
}
trap cleanup INT TERM

READY_WEB=0
for _ in $(seq 1 120); do
  if curl -sf -o /dev/null "http://127.0.0.1:3450/"; then
    READY_WEB=1
    break
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo ""
    echo "✗ 网站开发服务器已退出。最近日志："
    tail -n 40 "$WEB_LOG" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

if [ "$READY_WEB" -eq 1 ]; then
  echo "    ✓ 3450 已就绪"
else
  echo "    ⚠ 3450 超时；仍将启动 Metro，自然/接口可能暂不可用"
fi

METRO_ARGS=(--clear)
case "$MODE" in
  # 模拟器固定 localhost，避免连到 LAN IP 后 ⌘R 仍读旧 bundle。
  ios) METRO_ARGS+=(--ios --localhost) ;;
  android) METRO_ARGS+=(--android) ;;
esac

echo ""
echo "→ [2/2] 启动 Metro（本窗口）: npm run mobile:metro -- ${METRO_ARGS[*]}"
echo "    Metro 地址: http://localhost:8081"
echo ""

cd "$ROOT/apps/askbible-mobile"
exec npm run start -- "${METRO_ARGS[@]}"
