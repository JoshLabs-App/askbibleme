#!/usr/bin/env bash
# 从 EAS 拉取 Android upload keystore，供本机 Gradle 签名 Play AAB
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! npx eas whoami >/dev/null 2>&1; then
  echo ""
  echo "请先登录 Expo："
  echo "  cd apps/askbible-mobile && npx eas login"
  echo ""
  exit 1
fi

node "$ROOT/scripts/fetch-android-upload-keystore-from-eas.mjs"

echo ""
echo "下一步："
echo "  npm run mobile:build:android:production"
echo "  npm run mobile:release:android:internal"
