#!/usr/bin/env bash
# 真机 Wi‑Fi 开发：确保 API + Metro 在 LAN 上，并提示/尝试重连开发版 App
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKG="me.askbible"
LAN="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me · Android Wi‑Fi 重连"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [[ -z "$LAN" ]]; then
  echo "✗ 未获取到 Mac 局域网 IP（请连 Wi‑Fi）" >&2
  exit 1
fi

ENV_FILE="$ROOT/apps/askbible-mobile/.env.local"
EXPECTED="http://${LAN}:3450"
if [[ -f "$ENV_FILE" ]] && ! grep -q "$LAN" "$ENV_FILE" 2>/dev/null; then
  echo "⚠ .env.local 里的 IP 可能过期，建议改为："
  echo "  EXPO_PUBLIC_ASKBIBLE_BASE_URL=$EXPECTED"
  echo ""
fi

# shellcheck source=/dev/null
source "$ROOT/apps/askbible-mobile/scripts/android-sdk-env.sh"
adb start-server >/dev/null 2>&1 || true

pick_device_serial() {
  adb devices 2>/dev/null | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ { print $1; exit }'
  adb devices 2>/dev/null | awk 'NR>1 && $2=="device" { print $1; exit }'
}

if ! curl -sf -o /dev/null "http://127.0.0.1:3450/"; then
  echo "→ 启动网站 API (3450)…"
  (cd "$ROOT" && npm run dev >"${TMPDIR:-/tmp}/askbible-web-dev.log" 2>&1 &)
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "http://127.0.0.1:3450/" && break
    sleep 1
  done
fi

if ! curl -sf -o /dev/null "http://127.0.0.1:8081/status"; then
  echo "→ 启动 Metro (--lan --clear)…"
  (cd "$ROOT/apps/askbible-mobile" && REACT_NATIVE_PACKAGER_HOSTNAME="$LAN" npx expo start --lan --clear \
    >"${TMPDIR:-/tmp}/askbible-metro-wifi.log" 2>&1 &)
  for _ in $(seq 1 90); do
    curl -sf -o /dev/null "http://127.0.0.1:8081/status" && break
    sleep 1
  done
else
  echo "→ Metro 已在运行；建议终端里 Shift+R 或重启 Metro 以清掉旧 JS 缓存"
fi

echo ""
echo "  Mac IP:     $LAN"
echo "  网站 API:   http://${LAN}:3450"
echo "  Metro:      http://${LAN}:8081"
echo "  开发连接:   askbible://expo-development-client/?url=http%3A%2F%2F${LAN}%3A8081"
echo ""
echo "  手机与 Mac 须同一 Wi‑Fi（勿用访客网络）；在手机上："
echo "  摇一摇 → Reload（或 Change bundle location → 填 http://${LAN}:8081）"
echo ""
echo "  若手机浏览器打不开 http://${LAN}:8081 ："
echo "  多为路由器「AP/客户端隔离」→ 请插 USB 双击「12-Android-USB隧道.command」"
echo ""

SERIAL="$(pick_device_serial || true)"
if [[ -n "$SERIAL" ]]; then
  echo "→ 已通过 USB 帮手机打开开发连接 ($SERIAL)…"
  adb -s "$SERIAL" shell am force-stop "$PKG" >/dev/null 2>&1 || true
  sleep 0.4
  adb -s "$SERIAL" shell am start -a android.intent.action.VIEW \
    -d "askbible://expo-development-client/?url=http%3A%2F%2F${LAN}%3A8081" "$PKG" >/dev/null 2>&1 || true
  echo "✓ 已尝试启动"
else
  echo "  （未插 USB：请手动关掉 App 再打开，或摇一摇 → Reload）"
fi

echo ""
