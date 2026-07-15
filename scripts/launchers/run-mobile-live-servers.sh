#!/usr/bin/env bash
# 一键启动：本地 API(3450) + Expo Metro LAN(8081)，用于真机实时开发
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me · 真机实时开发服务"
echo "  目录: $ROOT"
echo ""
echo "  将启动："
echo "    ① 网站 API   http://localhost:3450"
echo "    ② Metro LAN  http://<你的Mac局域网IP>:8081"
echo ""
echo "  停止：本窗口 Control+C"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node scripts/free-port.mjs 3450
node scripts/free-port.mjs 8081
sleep 1

WEB_LOG="${TMPDIR:-/tmp}/askbible-web-dev.log"
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
    echo "✗ 网站 API 已退出。最近日志："
    tail -n 40 "$WEB_LOG" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

if [ "$READY_WEB" -eq 1 ]; then
  echo "    ✓ 3450 已就绪"
else
  echo "    ⚠ 3450 超时；仍将启动 Metro"
fi

CONNECTION_MODE="${EXPO_CONNECTION_MODE:-tunnel}"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [ "$CONNECTION_MODE" = "lan" ] && [ -n "$LAN_IP" ]; then
  echo "    真机应连接: http://${LAN_IP}:8081"
  export REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP"
  mkdir -p "$ROOT/apps/askbible-mobile/ios"
  printf '%s\n' "export REACT_NATIVE_PACKAGER_HOSTNAME=${LAN_IP}" >"$ROOT/apps/askbible-mobile/ios/.xcode.env.local"
else
  echo "    真机应连接: Expo tunnel"
fi

echo ""
if [ "$CONNECTION_MODE" = "lan" ]; then
  echo "→ [2/2] 启动 Metro（Dev Client + LAN）: npx expo start --dev-client --lan --clear"
else
  echo "→ [2/2] 启动 Metro（Dev Client + Tunnel）: npx expo start --dev-client --tunnel --clear"
fi
echo ""

cd "$ROOT/apps/askbible-mobile"
if [ "$CONNECTION_MODE" = "lan" ]; then
  exec npx expo start --dev-client --lan --clear
else
  exec npx expo start --dev-client --tunnel --clear
fi
