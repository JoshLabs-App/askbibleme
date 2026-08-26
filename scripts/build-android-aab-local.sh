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
export EXPO_PUBLIC_MOBILE_BUNDLED_ONLY="${EXPO_PUBLIC_MOBILE_BUNDLED_ONLY:-1}"
export EXPO_PUBLIC_MEMBER_REGISTER_ENABLED="${EXPO_PUBLIC_MEMBER_REGISTER_ENABLED:-1}"
export EXPO_PUBLIC_ASKBIBLE_BASE_URL="${EXPO_PUBLIC_ASKBIBLE_BASE_URL:-https://askbible.me}"
export EXPO_PUBLIC_MEMBER_SYNC_DEBUG="${EXPO_PUBLIC_MEMBER_SYNC_DEBUG:-1}"
export MOBILE_BUNDLE_OFFLINE_MEDIA="${MOBILE_BUNDLE_OFFLINE_MEDIA:-1}"
# 默认不设 LIMIT → sync 全量本地音乐；调试可 export MOBILE_BUNDLE_MUSIC_LIMIT=N
export MOBILE_STARTER_MUSIC_TRACK_ID="${MOBILE_STARTER_MUSIC_TRACK_ID:-track-mt391okyjj4i}"

# Store AAB must never ship with preview OTA enabled.
unset ASKBIBLE_OTA_CHANNEL || true
echo "→ OTA native config: store-safe (updates off)"
ASKBIBLE_OTA_CHANNEL= node "$ROOT/scripts/sync-mobile-ota-native-config.mjs"

echo "→ 同步图标与离线内容…"
bash "$ROOT/scripts/clear-mobile-bundle-cache.sh"
npm run mobile:sync-icons
npm run mobile:sync-content
node scripts/sync-explore-featured-articles-localized.mjs
npm run mobile:sync-android-icons
# 安卓商店默认：每专辑第一首进 base，其余走 R2（勿开 PAD，除非显式遗留路径）
# 见 scripts/sync-mobile-offline-media.mjs、.cursor/rules/android-release.mdc
export MOBILE_ANDROID_MUSIC_PAD="${MOBILE_ANDROID_MUSIC_PAD:-0}"
if [[ "$MOBILE_ANDROID_MUSIC_PAD" == "1" || "$MOBILE_ANDROID_MUSIC_PAD" == "true" ]]; then
  if [[ "${ALLOW_ANDROID_MUSIC_PAD:-}" != "1" ]]; then
    echo "✗ 拒绝 MOBILE_ANDROID_MUSIC_PAD=1：商店默认是 R2 首曲，误开会把 AAB 打到 ~650MB。" >&2
    echo "  现行：不要设此变量（默认 0）。遗留 PAD 仅当用户明确要求时：" >&2
    echo "  ALLOW_ANDROID_MUSIC_PAD=1 MOBILE_ANDROID_MUSIC_PAD=1 npm run mobile:build:android:production" >&2
    echo "  见 docs/mobile-android-music-pad.md、.cursor/rules/android-release.mdc" >&2
    exit 1
  fi
  echo "⚠ 已允许遗留 PAD（ALLOW_ANDROID_MUSIC_PAD=1）；AAB 会显著变大。"
fi
MOBILE_BUNDLE_OFFLINE_MEDIA=1 \
MOBILE_ANDROID_MUSIC_PAD="$MOBILE_ANDROID_MUSIC_PAD" \
MOBILE_STARTER_MUSIC_TRACK_ID="${MOBILE_STARTER_MUSIC_TRACK_ID:-track-mt391okyjj4i}" \
npm run mobile:sync-offline-media

echo "→ 离线媒体体积审计…"
MOBILE_ANDROID_MUSIC_PAD="$MOBILE_ANDROID_MUSIC_PAD" npm run mobile:audit:bundle-size

echo "→ 校验归档资源是否包含 mp3/mp4/sqlite…"
if [[ "${SKIP_EAS_ARCHIVE_CHECK:-}" == "1" ]]; then
  echo "  （已跳过 EAS archive inspect：SKIP_EAS_ARCHIVE_CHECK=1）"
else
  EAS_ARCHIVE_PLATFORM=android node scripts/verify-eas-archive-assets.mjs || {
    echo "⚠ EAS archive inspect 失败；本机构建可设 SKIP_EAS_ARCHIVE_CHECK=1 跳过。" >&2
    exit 1
  }
fi

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
LATEST="$OUT/askbible-android-latest.aab"
cp "$AAB" "$LATEST"
# 只保留一版库存；不写带时间戳副本（见 docs/mobile-build-artifacts.md）
bash "$ROOT/scripts/prune-mobile-dist.sh"

AAB_BYTES="$(wc -c < "$LATEST" | tr -d ' ')"
AAB_MB=$((AAB_BYTES / 1024 / 1024))
echo ""
echo "Built AAB: $LATEST (versionCode ${VERSION_CODE})"
echo "AAB size: ${AAB_MB} MB"
# R2 首曲包通常 ~160MB；误开 PAD 会到 ~650MB。250MB 以上先拦一下。
if [[ "$AAB_MB" -gt 250 && "${ALLOW_ANDROID_MUSIC_PAD:-}" != "1" ]]; then
  echo "✗ AAB 异常偏大（${AAB_MB} MB）。可能误打了全量音乐 / PAD。勿直接上传。" >&2
  echo "  核对 MOBILE_ANDROID_MUSIC_PAD / MOBILE_BUNDLE_MUSIC_FULL；见 .cursor/rules/android-release.mdc" >&2
  exit 1
fi
echo ""
echo "直传 Google Play 内部测试（不经 Expo）："
echo "  npm run mobile:submit:android:internal"
echo "或一步构建+提交："
echo "  npm run mobile:release:android:internal"
