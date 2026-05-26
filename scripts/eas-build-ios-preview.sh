#!/usr/bin/env bash
# 无线安装到 iPhone：preview 内测包（bundled-only，不依赖 Metro / askbible.me）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ 同步图标与离线内容…"
npm run mobile:sync-icons
npm run mobile:sync-content
MOBILE_BUNDLE_OFFLINE_MEDIA=1 npm run mobile:sync-offline-media

cd apps/askbible-mobile

if ! npx eas whoami >/dev/null 2>&1; then
  echo ""
  echo "尚未登录 Expo。请先在本机终端执行："
  echo "  cd apps/askbible-mobile && npx eas login"
  echo ""
  echo "登录完成后重新运行："
  echo "  npm run mobile:build:ios:internal"
  exit 1
fi

echo "→ 提交 EAS iOS preview 构建（internal，真机可装）…"
EXPO_PUBLIC_MOBILE_BUNDLED_ONLY=1 MOBILE_BUNDLE_OFFLINE_MEDIA=1 npx eas build --profile preview --platform ios "$@"
