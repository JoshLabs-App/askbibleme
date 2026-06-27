#!/usr/bin/env bash
# iPhone 真机 Wi‑Fi / Tunnel 重连 Metro（避免 iproxy 与 Metro 抢 8081）
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/apps/askbible-mobile"
PKG="me.askbible"
# shellcheck source=../ios/resolve-ios-test-device.sh
source "$ROOT/scripts/ios/resolve-ios-test-device.sh"

LAN="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me · iPhone 重连 Metro"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if ! resolve_ios_test_device "$MOBILE" 2>/dev/null; then
  echo "⚠ 未找到在线 iPhone（home）。请：数据线连接、解锁、信任此电脑。"
  echo "  xcrun xctrace list devices"
  IOS_DEVICE_UDID="00008101-001641020C98001E"
fi

if [[ -n "$LAN" && -f "$MOBILE/.env.local" ]]; then
  sed -i '' "s|EXPO_PUBLIC_ASKBIBLE_BASE_URL=http://[^:]*:3450|EXPO_PUBLIC_ASKBIBLE_BASE_URL=http://${LAN}:3450|" "$MOBILE/.env.local"
  sed -i '' "s|EXPO_PUBLIC_ASKBIBLE_DEV_LAN_HOST=.*|EXPO_PUBLIC_ASKBIBLE_DEV_LAN_HOST=${LAN}|" "$MOBILE/.env.local"
fi

mkdir -p "$MOBILE/ios"
if [[ -n "$LAN" ]]; then
  printf '%s\n' "export REACT_NATIVE_PACKAGER_HOSTNAME=${LAN}" >"$MOBILE/ios/.xcode.env.local"
else
  printf '%s\n' 'export REACT_NATIVE_PACKAGER_HOSTNAME=localhost' >"$MOBILE/ios/.xcode.env.local"
fi

if ! curl -sf -o /dev/null "http://127.0.0.1:3450/"; then
  echo "→ 启动网站 API (3450)…"
  (cd "$ROOT" && npm run dev >"${TMPDIR:-/tmp}/askbible-web-dev.log" 2>&1 &)
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "http://127.0.0.1:3450/" && break
    sleep 1
  done
fi

METRO_LOG="${TMPDIR:-/tmp}/askbible-metro-ios-wifi.log"
METRO_MODE="lan"
METRO_HOST="$LAN"

if ! curl -sf -o /dev/null "http://127.0.0.1:8081/status"; then
  echo "→ 启动 Metro…"
  pkill -f "iproxy 8081" 2>/dev/null || true
  if [[ -n "$LAN" ]]; then
    (
      cd "$MOBILE"
      export REACT_NATIVE_PACKAGER_HOSTNAME="$LAN"
      npx expo start --lan --clear >"$METRO_LOG" 2>&1
    ) &
    for _ in $(seq 1 90); do
      curl -sf -o /dev/null "http://127.0.0.1:8081/status" && break
      sleep 1
    done
    if ! curl -sf -o /dev/null "http://${LAN}:8081/status" 2>/dev/null; then
      echo "    ⚠ 局域网无法访问 Metro，改用 --tunnel"
      pkill -f "expo start" 2>/dev/null || true
      sleep 1
      (cd "$MOBILE" && npx expo start --tunnel --clear >"$METRO_LOG" 2>&1) &
      METRO_MODE="tunnel"
      METRO_HOST=""
      for _ in $(seq 1 120); do
        curl -sf -o /dev/null "http://127.0.0.1:8081/status" && break
        sleep 1
      done
    fi
  else
    (cd "$MOBILE" && npx expo start --tunnel --clear >"$METRO_LOG" 2>&1) &
    METRO_MODE="tunnel"
    for _ in $(seq 1 120); do
      curl -sf -o /dev/null "http://127.0.0.1:8081/status" && break
      sleep 1
    done
  fi
else
  echo "→ Metro 已在运行（建议 Shift+R 或重启以清缓存）"
fi

BUNDLE_URL=""
if [[ "$METRO_MODE" == "tunnel" ]]; then
  for _ in $(seq 1 60); do
    BUNDLE_URL="$(rg -o 'https://[^ ]+-anonymous-8081\.exp\.direct' "$METRO_LOG" 2>/dev/null | head -1 || true)"
    [[ -n "$BUNDLE_URL" ]] && break
    sleep 1
  done
  if [[ -z "$BUNDLE_URL" ]]; then
    BUNDLE_URL="$(rg -o 'exp://[^ ]+' "$METRO_LOG" 2>/dev/null | head -1 || true)"
  fi
  if [[ -n "$BUNDLE_URL" ]]; then
    BUNDLE_URL="${BUNDLE_URL%/}/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false"
  fi
else
  BUNDLE_URL="http://${LAN}:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false"
fi

echo ""
echo "  Metro 模式: $METRO_MODE"
echo "  Mac IP:     ${LAN:-（无 Wi‑Fi，已用 tunnel）}"
echo "  Bundle:     ${BUNDLE_URL:-见 $METRO_LOG}"
echo "  日志:       tail -f $METRO_LOG"
echo ""

if [[ -z "${IOS_DEVICE_UDID:-}" ]]; then
  echo "⚠ 设备离线，请连接后重新运行本脚本。"
  exit 1
fi

if [[ -n "$BUNDLE_URL" ]]; then
  ENCODED="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$BUNDLE_URL")"
  echo "→ 用开发地址启动 App …"
  xcrun devicectl device process launch --device "$IOS_DEVICE_UDID" \
    --payload-url "askbible://expo-development-client/?url=${ENCODED}" 2>/dev/null \
    || xcrun devicectl device process launch --device "$IOS_DEVICE_UDID" "$PKG" 2>/dev/null \
    || true
  echo "  若仍红屏：从 Xcode 重装 Debug 包（npm run mobile:ios:device:metro）"
  echo "  或装独立 Release：npm run mobile:ios:device"
else
  echo "→ 启动 App（Metro URL 未解析，请查看日志后手动 Reload）"
  xcrun devicectl device process launch --device "$IOS_DEVICE_UDID" "$PKG" 2>/dev/null || true
fi
