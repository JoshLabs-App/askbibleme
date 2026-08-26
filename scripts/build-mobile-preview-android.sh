#!/usr/bin/env bash
# 本机打 Preview OTA 壳（Release APK）：装一次后可用 eas update 热更，无需 USB / Metro
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export ASKBIBLE_OTA_CHANNEL="${ASKBIBLE_OTA_CHANNEL:-preview}"
export EXPO_PUBLIC_MOBILE_BUNDLED_ONLY="${EXPO_PUBLIC_MOBILE_BUNDLED_ONLY:-1}"
export EXPO_PUBLIC_MOBILE_OFFLINE_FIRST="${EXPO_PUBLIC_MOBILE_OFFLINE_FIRST:-0}"
export EXPO_PUBLIC_ASKBIBLE_BASE_URL="${EXPO_PUBLIC_ASKBIBLE_BASE_URL:-https://askbible.me}"
export EXPO_PUBLIC_TELEMETRY_DISABLED="${EXPO_PUBLIC_TELEMETRY_DISABLED:-1}"
export MOBILE_BUNDLE_OFFLINE_MEDIA="${MOBILE_BUNDLE_OFFLINE_MEDIA:-1}"

MOBILE="$ROOT/apps/askbible-mobile"

restore_ota_off() {
  unset ASKBIBLE_OTA_CHANNEL || true
  ASKBIBLE_OTA_CHANNEL= node "$ROOT/scripts/sync-mobile-ota-native-config.mjs" >/dev/null 2>&1 || true
}
trap restore_ota_off EXIT

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me · Android Preview OTA 壳"
echo "  channel: $ASKBIBLE_OTA_CHANNEL"
echo "  装到真机后：npm run mobile:update:preview"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "→ 写入 preview OTA 原生配置…"
node "$ROOT/scripts/sync-mobile-ota-native-config.mjs"

bash "$ROOT/scripts/build-mobile-apk-local.sh"

echo ""
echo "✓ Preview APK 已打出（见上方 Built: 路径）。"
echo "  安装：npm run mobile:install:apk:device"
echo "  或把 APK 拷到手机安装。"
echo "  之后热更（电脑发完可关机）：npm run mobile:update:preview"
echo ""
