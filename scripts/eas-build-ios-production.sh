#!/usr/bin/env bash
# 已弃用：EAS 云端 iOS 构建。请用 npm run mobile:build:ios:production（本机 --local）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "⚠️  此脚本为 EAS 云端构建（已弃用）。常规发版请用："
echo "    npm run mobile:build:ios:production"
echo ""
if [[ "${EAS_CLOUD_BUILD_OK:-}" != "1" ]]; then
  echo "已取消。若确需云端构建，请设 EAS_CLOUD_BUILD_OK=1"
  exit 1
fi

if ! npx eas whoami >/dev/null 2>&1; then
  echo ""
  echo "尚未登录 Expo。请先执行："
  echo "  cd apps/askbible-mobile && npx eas login"
  echo ""
  exit 1
fi

if [[ -z "${ASC_API_KEY_PATH:-}" ]]; then
  echo ""
  echo "缺少 ASC_API_KEY_PATH。请先设置 App Store Connect API Key 文件路径，例如："
  echo "  export ASC_API_KEY_PATH=/absolute/path/AuthKey_xxx.p8"
  echo ""
  exit 1
fi

if [[ ! -f "${ASC_API_KEY_PATH}" ]]; then
  echo ""
  echo "ASC_API_KEY_PATH 指向的文件不存在：${ASC_API_KEY_PATH}"
  echo ""
  exit 1
fi

echo "→ 同步图标与离线内容…"
npm run mobile:sync-icons
npm run mobile:sync-content
MOBILE_BUNDLE_OFFLINE_MEDIA=1 \
MOBILE_ANDROID_MUSIC_PAD=0 \
MOBILE_STARTER_MUSIC_TRACK_ID=track-mt391okyjj4i \
npm run mobile:sync-offline-media

echo "→ 离线资源体积审计…"
MOBILE_ANDROID_MUSIC_PAD=0 npm run mobile:audit:bundle-size

echo "→ 校验 EAS 归档是否包含 mp3/mp4/sqlite…"
node scripts/verify-eas-archive-assets.mjs

cd apps/askbible-mobile

echo "→ 提交 EAS iOS production 构建…"
EXPO_PUBLIC_MOBILE_OFFLINE_FIRST=1 \
EXPO_PUBLIC_MOBILE_BUNDLED_ONLY=1 \
EXPO_PUBLIC_MEMBER_REGISTER_ENABLED=1 \
EXPO_PUBLIC_ASKBIBLE_BASE_URL="https://askbible.me" \
MOBILE_BUNDLE_OFFLINE_MEDIA=1 \
npx eas build --profile production --platform ios --non-interactive "$@"
