#!/usr/bin/env bash
# 已弃用：EAS 云端 Android 构建。默认请用本机：npm run mobile:build:android:production
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "⚠️  此脚本为 EAS 云端构建（已弃用）。常规发版请用："
echo "    npm run mobile:build:android:production"
echo ""
if [[ "${EAS_CLOUD_BUILD_OK:-}" != "1" ]]; then
  echo "已取消。若确需云端构建，请设 EAS_CLOUD_BUILD_OK=1"
  exit 1
fi

echo "提示：默认已改为本机 Gradle 构建。"
echo ""

if ! npx eas whoami >/dev/null 2>&1; then
  echo ""
  echo "尚未登录 Expo。请先执行："
  echo "  cd apps/askbible-mobile && npx eas login"
  echo ""
  exit 1
fi

echo "→ 同步图标与离线内容…"
npm run mobile:sync-icons
npm run mobile:sync-content
# Bundle music/nature offline media into release assets.
MOBILE_BUNDLE_OFFLINE_MEDIA=1 \
MOBILE_BUNDLE_MUSIC_LIMIT=1 \
MOBILE_STARTER_MUSIC_TRACK_ID=track-mpg4a8h3jhwl \
npm run mobile:sync-offline-media

echo "→ 离线媒体体积审计…"
npm run mobile:audit:bundle-size

echo "→ 校验 EAS 归档是否包含 mp3/mp4/sqlite…"
EAS_ARCHIVE_PLATFORM=android node scripts/verify-eas-archive-assets.mjs

cd apps/askbible-mobile

echo "→ 提交 EAS Android production 构建（AAB）…"
EXPO_PUBLIC_MOBILE_OFFLINE_FIRST=1 \
EXPO_PUBLIC_MOBILE_BUNDLED_ONLY=0 \
EXPO_PUBLIC_MEMBER_REGISTER_ENABLED=1 \
EXPO_PUBLIC_ASKBIBLE_BASE_URL="https://askbible.me" \
MOBILE_BUNDLE_OFFLINE_MEDIA=1 \
npx eas build --profile production --platform android --non-interactive "$@"
