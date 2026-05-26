#!/usr/bin/env bash
# 真机开发：Metro + 本机 API + Debug 包（热更新；装完后需保持 Metro 运行）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me · iPhone 真机（Metro 开发）"
echo "  项目: $ROOT/apps/askbible-mobile"
echo ""
echo "  ① 同步经文/文案"
echo "  ② 本机 Metro  http://<你的 Mac IP>:8081"
echo "  ③ expo run:ios --device（Debug，需连 Metro）"
echo ""
echo "  独立离线包请用: npm run mobile:ios:device"
echo "  请保持 iPhone 与 Mac 同一 Wi‑Fi；首次请在手机上信任开发者证书。"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node scripts/free-port.mjs 3450
node scripts/free-port.mjs 8081
sleep 1

echo "→ npm run mobile:sync-content"
npm run mobile:sync-content

WEB_LOG="${TMPDIR:-/tmp}/askbible-web-dev.log"
echo ""
echo "→ [1/3] 后台启动网站 API: npm run dev"
echo "    日志: tail -f $WEB_LOG"
npm run dev >"$WEB_LOG" 2>&1 &
WEB_PID=$!

METRO_LOG="${TMPDIR:-/tmp}/askbible-metro-device.log"
echo "→ [2/3] 后台启动 Metro（--lan）…  日志: tail -f $METRO_LOG"

cd "$ROOT/apps/askbible-mobile"
npx expo start --lan --clear >"$METRO_LOG" 2>&1 &
METRO_PID=$!

cleanup() {
  echo ""
  echo "→ 正在停止 Metro ($METRO_PID) 与网站 API ($WEB_PID) …"
  kill "$METRO_PID" 2>/dev/null || true
  kill "$WEB_PID" 2>/dev/null || true
  wait "$METRO_PID" 2>/dev/null || true
  wait "$WEB_PID" 2>/dev/null || true
}
trap cleanup INT TERM

for _ in $(seq 1 120); do
  if curl -sf -o /dev/null "http://127.0.0.1:3450/"; then
    echo "    ✓ 3450 已就绪"
    break
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo "✗ 网站 API 已退出。最近日志："
    tail -n 40 "$WEB_LOG" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

READY=0
for _ in $(seq 1 90); do
  if curl -sf -o /dev/null "http://127.0.0.1:8081/status" 2>/dev/null; then
    READY=1
    break
  fi
  if ! kill -0 "$METRO_PID" 2>/dev/null; then
    echo "✗ Metro 已退出。最近日志："
    tail -n 40 "$METRO_LOG" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "⚠ Metro 8081 未在 90s 内就绪，仍将尝试安装"
else
  echo "    ✓ Metro 已就绪"
fi

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [ -n "$LAN_IP" ]; then
  echo "    真机应能访问: http://${LAN_IP}:8081"
  export REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP"
fi

echo ""
echo "→ [3/3] expo run:ios --device（Debug；装完后勿关 Metro）"
echo ""

npx expo run:ios --device

echo ""
echo "✓ 若 App 仍报 No script URL："
echo "  - 确认 Metro 在跑（tail -f $METRO_LOG）"
echo "  - iPhone 与 Mac 同一 Wi‑Fi，关闭 VPN"
echo "  - 摇一摇 → Configure Bundler → ${LAN_IP:-Mac局域网IP}:8081"
echo "  - 或改装独立版: npm run mobile:ios:device"
echo ""
echo "→ Metro 保持运行 (pid $METRO_PID)。结束请 Control+C"
wait "$METRO_PID"
