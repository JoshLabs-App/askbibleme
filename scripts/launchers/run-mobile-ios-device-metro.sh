#!/usr/bin/env bash
# 真机开发：Metro + 本机 API + Debug 包（热更新；装完后需保持 Metro 运行，iPhone 与 Mac 同 Wi‑Fi）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
MOBILE="$ROOT/apps/askbible-mobile"
# shellcheck source=../ios/resolve-ios-test-device.sh
source "$ROOT/scripts/ios/resolve-ios-test-device.sh"
IPROXY="${IPROXY:-$(command -v iproxy || true)}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me · iPhone 真机（Metro 开发）"
echo "  项目: $MOBILE"
echo ""
echo "  ① 同步经文/文案"
echo "  ② Metro LAN（同 Wi‑Fi）"
echo "  ③ expo run:ios --device（Debug）"
echo ""
echo "  请用数据线连接 iPhone；独立离线包: npm run mobile:ios:device"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node scripts/free-port.mjs 3450
node scripts/free-port.mjs 8081
pkill -f "iproxy 8081" 2>/dev/null || true
pkill -f "iproxy 3450" 2>/dev/null || true
sleep 1

echo "→ npm run mobile:sync-content"
npm run mobile:sync-content

# 真机：用 Mac 局域网 IP 连 Metro（与 Android Wi‑Fi 开发一致）。iproxy 会与 Metro 抢 8081，默认不用。
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
mkdir -p "$MOBILE/ios"
if [[ -n "$LAN_IP" ]]; then
  printf '%s\n' "export REACT_NATIVE_PACKAGER_HOSTNAME=${LAN_IP}" >"$MOBILE/ios/.xcode.env.local"
else
  printf '%s\n' 'export REACT_NATIVE_PACKAGER_HOSTNAME=localhost' >"$MOBILE/ios/.xcode.env.local"
fi
if [[ ! -f "$MOBILE/.env.local" ]]; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)"
  cat >"$MOBILE/.env.local" <<EOF
EXPO_PUBLIC_ASKBIBLE_BASE_URL=http://${LAN_IP}:3450
EXPO_PUBLIC_ASKBIBLE_DEV_LAN_HOST=${LAN_IP}
EOF
fi

WEB_LOG="${TMPDIR:-/tmp}/askbible-web-dev.log"
echo ""
echo "→ [1/4] 后台启动网站 API: npm run dev"
echo "    日志: tail -f $WEB_LOG"
npm run dev >"$WEB_LOG" 2>&1 &
WEB_PID=$!

METRO_LOG="${TMPDIR:-/tmp}/askbible-metro-device.log"
echo "→ [2/4] 后台启动 Metro（LAN）…  日志: tail -f $METRO_LOG"
if [[ -n "$LAN_IP" ]]; then
  echo "    iPhone 需与 Mac 同一 Wi‑Fi；Metro: http://${LAN_IP}:8081"
fi

cd "$MOBILE"
if [[ -n "$LAN_IP" ]]; then
  REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP" npx expo start --lan --clear >"$METRO_LOG" 2>&1 &
else
  npx expo start --tunnel --clear >"$METRO_LOG" 2>&1 &
fi
METRO_PID=$!
IPROXY8081_PID=""

cleanup() {
  echo ""
  echo "→ 正在停止 Metro / API / iproxy …"
  kill "$METRO_PID" 2>/dev/null || true
  kill "$WEB_PID" 2>/dev/null || true
  [[ -n "$IPROXY8081_PID" ]] && kill "$IPROXY8081_PID" 2>/dev/null || true
  [[ -n "$IPROXY3450_PID" ]] && kill "$IPROXY3450_PID" 2>/dev/null || true
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

resolve_ios_test_device "$MOBILE"

echo ""
echo "→ [3/4] iOS Debug 签名（Development Profile）"
node "$ROOT/scripts/ios/ensure-ios-development-signing.mjs"
node "$ROOT/scripts/ios/patch-ios-debug-signing.mjs"

echo ""
echo "→ [4/4] 编译并安装到 ${IOS_DEVICE}（${IOS_UDID}）"
echo ""

set +e
npx expo run:ios --device "$IOS_DEVICE" --no-bundler
RUN_EXIT=$?
set -e

APP_PATH="$HOME/Library/Developer/Xcode/DerivedData/AskBibleme-"*/Build/Products/Debug-iphoneos/AskBibleme.app
if [[ $RUN_EXIT -ne 0 ]] && compgen -G "$APP_PATH" > /dev/null; then
  echo "→ expo 安装卡住/失败，改用 devicectl 安装…"
  xcrun devicectl device install app --device "$IOS_UDID" "$(ls -d $APP_PATH | head -1)"
fi

echo "→ 启动 App …"
xcrun devicectl device process launch --device "$IOS_UDID" me.askbible 2>/dev/null || true

echo ""
echo "✓ 开发版已安装。请保持本终端运行（Metro）。"
echo "  若红屏 No script URL：iPhone 与 Mac 同一 Wi‑Fi，或运行 bash scripts/launchers/reconnect-ios-wifi.sh"
echo "  独立 Release（不需 Metro）: npm run mobile:ios:device"
echo "  日志: tail -f $METRO_LOG"
echo ""
wait "$METRO_PID"
