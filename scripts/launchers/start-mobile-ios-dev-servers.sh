#!/usr/bin/env bash
# 仅启动真机开发所需后台服务（Metro + iproxy + 网站 API），不重新编译。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/apps/askbible-mobile"
IPROXY="${IPROXY:-$(command -v iproxy || true)}"

node "$ROOT/scripts/free-port.mjs" 8081
pkill -f "iproxy 8081" 2>/dev/null || true
sleep 1

if ! curl -sf -o /dev/null "http://127.0.0.1:3450/"; then
  echo "→ 启动网站 API (3450)…"
  npm --prefix "$ROOT" run dev >"${TMPDIR:-/tmp}/askbible-web-dev.log" 2>&1 &
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "http://127.0.0.1:3450/" && break
    sleep 1
  done
fi

echo "→ 启动 Metro (8081, LAN)…"
cd "$MOBILE"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [[ -n "$LAN_IP" && -f "$MOBILE/.env.local" ]]; then
  if grep -q "EXPO_PUBLIC_ASKBIBLE_BASE_URL=" "$MOBILE/.env.local"; then
    sed -i '' "s|EXPO_PUBLIC_ASKBIBLE_BASE_URL=http://[^:]*:3450|EXPO_PUBLIC_ASKBIBLE_BASE_URL=http://${LAN_IP}:3450|" "$MOBILE/.env.local"
    sed -i '' "s|EXPO_PUBLIC_ASKBIBLE_DEV_LAN_HOST=.*|EXPO_PUBLIC_ASKBIBLE_DEV_LAN_HOST=${LAN_IP}|" "$MOBILE/.env.local"
    echo "    ✓ .env.local API → http://${LAN_IP}:3450"
  fi
  mkdir -p "$MOBILE/ios"
  printf '%s\n' "export REACT_NATIVE_PACKAGER_HOSTNAME=${LAN_IP}" >"$MOBILE/ios/.xcode.env.local"
fi
if [[ -n "$LAN_IP" ]]; then
  REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP" npx expo start --lan >"${TMPDIR:-/tmp}/askbible-metro-live.log" 2>&1 &
else
  npx expo start --tunnel >"${TMPDIR:-/tmp}/askbible-metro-live.log" 2>&1 &
fi
METRO_PID=$!

for _ in $(seq 1 60); do
  if curl -sf -o /dev/null "http://127.0.0.1:8081/status" 2>/dev/null; then
    echo "    ✓ Metro 就绪"
    if [[ -n "$LAN_IP" ]]; then
      echo "    iPhone 请连同一 Wi‑Fi: http://${LAN_IP}:8081"
    else
      echo "    已用 tunnel 模式（见 Metro 日志中的 URL）"
    fi
    break
  fi
  sleep 1
done

echo ""
echo "✓ 开发服务已启动。保持本终端打开，然后在 iPhone 上打开 AskBible.me。"
echo "  若红屏: bash scripts/launchers/reconnect-ios-wifi.sh"
echo "  Metro 日志: tail -f ${TMPDIR:-/tmp}/askbible-metro-live.log"
echo "  结束: kill $METRO_PID"
wait "$METRO_PID"
