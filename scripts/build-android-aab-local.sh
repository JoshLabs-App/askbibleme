#!/usr/bin/env bash
# 本机 Gradle 打出 Play 用 Release AAB（不经 EAS 云端构建）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/mobile-load-google-oauth-env.sh
source "$ROOT/scripts/mobile-load-google-oauth-env.sh"
load_mobile_google_oauth_env "$ROOT"

MOBILE="$ROOT/apps/askbible-mobile"
ANDROID="$MOBILE/android"
KEYSTORE_PROPS="$ANDROID/keystore.properties"

export EXPO_PUBLIC_MOBILE_OFFLINE_FIRST="${EXPO_PUBLIC_MOBILE_OFFLINE_FIRST:-1}"
export EXPO_PUBLIC_MOBILE_BUNDLED_ONLY="${EXPO_PUBLIC_MOBILE_BUNDLED_ONLY:-0}"
export EXPO_PUBLIC_MEMBER_REGISTER_ENABLED="${EXPO_PUBLIC_MEMBER_REGISTER_ENABLED:-1}"
export EXPO_PUBLIC_ASKBIBLE_BASE_URL="${EXPO_PUBLIC_ASKBIBLE_BASE_URL:-https://askbible.me}"
export EXPO_PUBLIC_MEMBER_SYNC_DEBUG="${EXPO_PUBLIC_MEMBER_SYNC_DEBUG:-1}"
export MOBILE_BUNDLE_OFFLINE_MEDIA="${MOBILE_BUNDLE_OFFLINE_MEDIA:-1}"
export MOBILE_BUNDLE_MUSIC_LIMIT="${MOBILE_BUNDLE_MUSIC_LIMIT:-1}"
export MOBILE_STARTER_MUSIC_TRACK_ID="${MOBILE_STARTER_MUSIC_TRACK_ID:-track-mpg4a7xcip5q}"

echo "→ 同步图标与离线内容…"
npm run mobile:sync-icons
npm run mobile:sync-content
node scripts/sync-explore-featured-articles-localized.mjs
npm run mobile:sync-android-icons
MOBILE_BUNDLE_OFFLINE_MEDIA=1 \
MOBILE_BUNDLE_MUSIC_LIMIT=1 \
MOBILE_STARTER_MUSIC_TRACK_ID=track-mpg4a7xcip5q \
npm run mobile:sync-offline-media

echo "→ 离线媒体体积审计…"
npm run mobile:audit:bundle-size

echo "→ 校验归档资源是否包含 mp3/mp4/sqlite…"
EAS_ARCHIVE_PLATFORM=android node scripts/verify-eas-archive-assets.mjs

if [[ ! -f "$MOBILE/scripts/android-sdk-env.sh" ]]; then
  echo "Missing apps/askbible-mobile/scripts/android-sdk-env.sh" >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$MOBILE/scripts/android-sdk-env.sh"

if [[ ! -f "$KEYSTORE_PROPS" ]]; then
  echo "→ 未找到本机签名，正在从 EAS 拉取 upload keystore…"
  node "$ROOT/scripts/fetch-android-upload-keystore-from-eas.mjs"
fi

ENV_LOCAL="$MOBILE/.env.local"
ENV_LOCAL_BAK="$MOBILE/.env.local.release-build.bak"
if [[ -f "$ENV_LOCAL" ]]; then
  echo "→ 暂存 .env.local（避免 LAN 开发地址打进 release）"
  mv "$ENV_LOCAL" "$ENV_LOCAL_BAK"
  trap '[[ -f "$MOBILE/.env.local.release-build.bak" ]] && mv -f "$MOBILE/.env.local.release-build.bak" "$MOBILE/.env.local"' EXIT
fi

cd "$ANDROID"

echo "→ Gradle bundleRelease (local AAB, offline-first=${EXPO_PUBLIC_MOBILE_OFFLINE_FIRST})"
./gradlew bundleRelease "$@"

AAB="$ANDROID/app/build/outputs/bundle/release/app-release.aab"
if [[ ! -f "$AAB" ]]; then
  echo "AAB not found: $AAB" >&2
  exit 1
fi

VERSION_CODE="$(node -e "
  const fs = require('fs');
  const gradle = fs.readFileSync('$ANDROID/app/build.gradle','utf8');
  const m = gradle.match(/versionCode\\s+(\\d+)/);
  if (!m) process.exit(1);
  process.stdout.write(m[1]);
")"

OUT="$ROOT/dist/mobile"
mkdir -p "$OUT"
STAMP="$(date +%Y%m%d-%H%M)"
DEST="$OUT/askbible-android-v${VERSION_CODE}-${STAMP}.aab"
LATEST="$OUT/askbible-android-latest.aab"
cp "$AAB" "$DEST"
cp "$AAB" "$LATEST"

echo ""
echo "Built AAB: $DEST"
echo "Latest symlink copy: $LATEST"
echo ""
echo "直传 Google Play 内部测试（不经 Expo）："
echo "  npm run mobile:submit:android:internal"
echo "或一步构建+提交："
echo "  npm run mobile:release:android:internal"
