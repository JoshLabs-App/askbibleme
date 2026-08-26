#!/usr/bin/env bash
# USB 装一次 Preview OTA 壳到 iPhone（Release）；之后可用 eas update，无需再连线
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/mobile-load-google-oauth-env.sh
source "$ROOT/scripts/mobile-load-google-oauth-env.sh"
load_mobile_google_oauth_env "$ROOT"

export ASKBIBLE_OTA_CHANNEL="${ASKBIBLE_OTA_CHANNEL:-preview}"
export EXPO_NO_DOTENV=1
export EXPO_PUBLIC_MOBILE_OFFLINE_FIRST="${EXPO_PUBLIC_MOBILE_OFFLINE_FIRST:-0}"
export EXPO_PUBLIC_MOBILE_BUNDLED_ONLY="${EXPO_PUBLIC_MOBILE_BUNDLED_ONLY:-1}"
export EXPO_PUBLIC_ASKBIBLE_BASE_URL="${EXPO_PUBLIC_ASKBIBLE_BASE_URL:-https://askbible.me}"
export EXPO_PUBLIC_TELEMETRY_DISABLED="${EXPO_PUBLIC_TELEMETRY_DISABLED:-1}"
export MOBILE_BUNDLE_OFFLINE_MEDIA="${MOBILE_BUNDLE_OFFLINE_MEDIA:-1}"

MOBILE="$ROOT/apps/askbible-mobile"

restore_ota_off() {
  if [[ -f "$MOBILE/.env.local.release-build.bak" ]]; then
    mv -f "$MOBILE/.env.local.release-build.bak" "$MOBILE/.env.local"
  fi
  unset ASKBIBLE_OTA_CHANNEL || true
  ASKBIBLE_OTA_CHANNEL= node "$ROOT/scripts/sync-mobile-ota-native-config.mjs" >/dev/null 2>&1 || true
}
trap restore_ota_off EXIT

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me · iPhone Preview OTA 壳"
echo "  channel: $ASKBIBLE_OTA_CHANNEL"
echo "  ① 本机 Release 装到已连接 iPhone（需 USB 一次）"
echo "  ② 之后热更：npm run mobile:update:preview（电脑发完可关机）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "→ Sync mobile bundled content…"
npm run mobile:sync-content
npm run mobile:sync-icons
npm run mobile:sync-offline-media

echo "→ 写入 preview OTA 原生配置…"
node "$ROOT/scripts/sync-mobile-ota-native-config.mjs"

ENV_LOCAL="$MOBILE/.env.local"
if [[ -f "$ENV_LOCAL" ]]; then
  echo "→ Stashing .env.local (keep LAN URL out of release)"
  mv "$ENV_LOCAL" "$MOBILE/.env.local.release-build.bak"
fi

cd "$MOBILE"

echo ""
echo "→ iOS Development 签名（USB 真机）…"
export ASC_API_KEY_PATH="${ASC_API_KEY_PATH:-$ROOT/AA/AuthKey_9HDA27WY8C.p8}"
node "$ROOT/scripts/ios/ensure-ios-development-signing.mjs"
node "$ROOT/scripts/ios/patch-ios-release-device-signing.mjs"

# shellcheck source=scripts/ios/resolve-ios-test-device.sh
source "$ROOT/scripts/ios/resolve-ios-test-device.sh"

echo ""
echo "→ expo run:ios --device --configuration Release (OTA channel=$ASKBIBLE_OTA_CHANNEL)"
if [[ "$*" == *"--device"* ]]; then
  ASKBIBLE_OTA_CHANNEL="$ASKBIBLE_OTA_CHANNEL" npx expo run:ios --configuration Release "$@"
else
  resolve_ios_test_device "$MOBILE"
  echo "   目标设备: ${IOS_DEVICE} (${IOS_DEVICE_UDID})"
  ASKBIBLE_OTA_CHANNEL="$ASKBIBLE_OTA_CHANNEL" npx expo run:ios --device "$IOS_DEVICE_UDID" --configuration Release "$@"
fi

echo ""
echo "✓ Preview OTA 壳已装到 iPhone。"
echo "  可拔线；之后发热更：npm run mobile:update:preview"
echo "  真机打开 App 1～2 次即可拉到新包。"
echo ""
