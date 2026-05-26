#!/usr/bin/env bash
# 路由器隔离 Wi‑Fi 时：USB + adb reverse，手机用 127.0.0.1 访问 Mac 上的 Metro/API
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKG="me.askbible"
ENV_FILE="$ROOT/apps/askbible-mobile/.env.local"
ENV_WIFI_BAK="$ENV_FILE.bak.wifi"
LAN="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me · Android USB 隧道"
echo "  （Wi‑Fi 访问不了 8081 时用）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# shellcheck source=/dev/null
source "$ROOT/apps/askbible-mobile/scripts/android-sdk-env.sh"
adb start-server >/dev/null 2>&1 || true

SERIAL="$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ { print $1; exit }')"
if [[ -z "$SERIAL" ]]; then
  echo "✗ 请用 USB 连接手机并开启 USB 调试（adb devices 要有 device）" >&2
  exit 1
fi
echo "→ 真机: $SERIAL"

echo "→ adb reverse（手机 127.0.0.1 → Mac 本机）"
adb -s "$SERIAL" reverse --remove-all 2>/dev/null || true
adb -s "$SERIAL" reverse tcp:8081 tcp:8081
adb -s "$SERIAL" reverse tcp:3450 tcp:3450
adb -s "$SERIAL" reverse --list

if [[ -f "$ENV_FILE" ]] && ! grep -q '127\.0\.0\.1:3450' "$ENV_FILE" 2>/dev/null; then
  cp "$ENV_FILE" "$ENV_WIFI_BAK"
  if grep -q 'EXPO_PUBLIC_ASKBIBLE_BASE_URL=' "$ENV_FILE"; then
    sed -i '' 's|EXPO_PUBLIC_ASKBIBLE_BASE_URL=.*|EXPO_PUBLIC_ASKBIBLE_BASE_URL=http://127.0.0.1:3450|' "$ENV_FILE"
  else
    echo 'EXPO_PUBLIC_ASKBIBLE_BASE_URL=http://127.0.0.1:3450' >>"$ENV_FILE"
  fi
  echo "→ 已把 .env.local API 改为 http://127.0.0.1:3450（原文件备份: .env.local.bak.wifi）"
fi

if ! curl -sf -o /dev/null "http://127.0.0.1:3450/"; then
  echo "→ 启动网站 API…"
  (cd "$ROOT" && npm run dev >"${TMPDIR:-/tmp}/askbible-web-dev.log" 2>&1 &)
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "http://127.0.0.1:3450/" && break
    sleep 1
  done
fi

if ! curl -sf -o /dev/null "http://127.0.0.1:8081/status"; then
  echo "→ 启动 Metro…"
  (cd "$ROOT/apps/askbible-mobile" && npx expo start --clear >"${TMPDIR:-/tmp}/askbible-metro-usb.log" 2>&1 &)
  for _ in $(seq 1 90); do
    curl -sf -o /dev/null "http://127.0.0.1:8081/status" && break
    sleep 1
  done
fi

BUNDLE_URL="http://127.0.0.1:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true&minify=false"
ENCODED_URL="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$BUNDLE_URL")"

echo ""
echo "  手机浏览器可试: http://127.0.0.1:8081 （应能打开 Metro 页）"
echo "  若仍 Unable to load script：摇一摇 → Change bundle location →"
echo "  $BUNDLE_URL"
echo ""
echo "→ 启动 App…"
adb -s "$SERIAL" shell am force-stop "$PKG" >/dev/null 2>&1 || true
sleep 0.4
adb -s "$SERIAL" shell am start -a android.intent.action.VIEW \
  -d "askbible://expo-development-client/?url=${ENCODED_URL}" "$PKG" >/dev/null

if [[ -n "$LAN" ]]; then
  echo ""
  echo "  恢复 Wi‑Fi 模式：改回 .env.local 为 http://${LAN}:3450"
  echo "  或: cp apps/askbible-mobile/.env.local.bak.wifi apps/askbible-mobile/.env.local"
fi
echo ""
echo "✓ USB 隧道已就绪（线请保持连接）"
