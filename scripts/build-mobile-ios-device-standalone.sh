#!/usr/bin/env bash
# USB 连接的 iPhone：安装 Release 独立包（内嵌 JS + 离线资源，无需 Metro / 本机 API）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/mobile-load-google-oauth-env.sh
source "$ROOT/scripts/mobile-load-google-oauth-env.sh"
load_mobile_google_oauth_env "$ROOT"

export EXPO_NO_DOTENV=1
export EXPO_PUBLIC_MOBILE_OFFLINE_FIRST="${EXPO_PUBLIC_MOBILE_OFFLINE_FIRST:-1}"
# 与商店包一致：允许章朗读联网（FHL / askbible.me）；BUNDLED_ONLY=1 会禁流且无包内章音频
export EXPO_PUBLIC_MOBILE_BUNDLED_ONLY="${EXPO_PUBLIC_MOBILE_BUNDLED_ONLY:-0}"
export EXPO_PUBLIC_ASKBIBLE_BASE_URL="${EXPO_PUBLIC_ASKBIBLE_BASE_URL:-https://askbible.me}"
export EXPO_PUBLIC_TELEMETRY_DISABLED="${EXPO_PUBLIC_TELEMETRY_DISABLED:-1}"
export MOBILE_BUNDLE_OFFLINE_MEDIA="${MOBILE_BUNDLE_OFFLINE_MEDIA:-1}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AskBible.me · iPhone 真机（独立 Release 包）"
echo "  项目: $ROOT/apps/askbible-mobile"
echo ""
echo "  ① 同步经文 / 文案 / 自然与音乐离线资源"
echo "  ② Xcode Release 编译并安装到已连接 iPhone"
echo "  ③ 装完后可断开 Mac；经文/导读/音乐包内可用；章朗读需联网或已下载音频包"
echo ""
echo "  需：数据线连接、Xcode、开发者证书；首次编译较慢。"
echo "  热更新开发（需 Metro）: npm run mobile:ios:device:metro"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "→ Sync mobile bundled content (scripture, locales, icons, offline media, …)"
npm run mobile:sync-content
npm run mobile:sync-icons
npm run mobile:sync-offline-media

MOBILE="$ROOT/apps/askbible-mobile"
ENV_LOCAL="$MOBILE/.env.local"
ENV_LOCAL_BAK="$MOBILE/.env.local.release-build.bak"
if [[ -f "$ENV_LOCAL" ]]; then
  echo "→ Stashing .env.local (keep LAN dev URL out of release build)"
  mv "$ENV_LOCAL" "$ENV_LOCAL_BAK"
  trap '[[ -f "$MOBILE/.env.local.release-build.bak" ]] && mv -f "$MOBILE/.env.local.release-build.bak" "$MOBILE/.env.local"' EXIT
fi

cd "$MOBILE"

echo ""
echo "→ expo run:ios --device --configuration Release"
echo "   bundled-only=$EXPO_PUBLIC_MOBILE_BUNDLED_ONLY"
echo ""

# shellcheck source=scripts/ios/resolve-ios-test-device.sh
source "$ROOT/scripts/ios/resolve-ios-test-device.sh"

if [[ "$*" == *"--device"* ]]; then
  npx expo run:ios --configuration Release "$@"
else
  resolve_ios_test_device "$MOBILE"
  echo "   目标设备: ${IOS_DEVICE} (${IOS_DEVICE_UDID})"
  npx expo run:ios --device "$IOS_DEVICE_UDID" --configuration Release "$@"
fi

echo ""
echo "✓ 独立版已安装到 iPhone。"
echo "  可拔掉数据线、关闭本终端；断网可读圣经与包内导读/自然/音乐（以本次同步进包的资源为准）。"
echo "  若要改内容后重装：再运行 npm run mobile:ios:device"
echo ""
