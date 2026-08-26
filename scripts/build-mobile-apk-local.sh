#!/usr/bin/env bash
# 本机打出 Android Release APK（侧载分发，无需 EAS 账号）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export EXPO_PUBLIC_MOBILE_BUNDLED_ONLY="${EXPO_PUBLIC_MOBILE_BUNDLED_ONLY:-1}"
export EXPO_PUBLIC_MOBILE_OFFLINE_FIRST="${EXPO_PUBLIC_MOBILE_OFFLINE_FIRST:-1}"
export EXPO_PUBLIC_ASKBIBLE_BASE_URL="${EXPO_PUBLIC_ASKBIBLE_BASE_URL:-https://askbible.me}"
export EXPO_PUBLIC_TELEMETRY_DISABLED="${EXPO_PUBLIC_TELEMETRY_DISABLED:-1}"
export MOBILE_BUNDLE_OFFLINE_MEDIA="${MOBILE_BUNDLE_OFFLINE_MEDIA:-1}"

# Preview OTA shells set ASKBIBLE_OTA_CHANNEL=preview before calling this script.
# Plain APK builds keep store-safe defaults (updates off).
if [[ -z "${ASKBIBLE_OTA_CHANNEL:-}" ]]; then
  echo "→ OTA native config: store-safe (updates off)"
  ASKBIBLE_OTA_CHANNEL= node "$ROOT/scripts/sync-mobile-ota-native-config.mjs"
fi

echo "→ Sync mobile bundled content (scripture, locales, icons, offline media, …)"
bash "$ROOT/scripts/clear-mobile-bundle-cache.sh"
npm run mobile:sync-content
npm run mobile:sync-icons
npm run mobile:sync-android-icons
# 侧载 APK 拿不到 Play fast-follow：默认全量进 base（商店 AAB 才开 PAD）
MOBILE_BUNDLE_OFFLINE_MEDIA=1 \
MOBILE_ANDROID_MUSIC_PAD="${MOBILE_ANDROID_MUSIC_PAD:-0}" \
npm run mobile:sync-offline-media

if [[ ! -f "apps/askbible-mobile/scripts/android-sdk-env.sh" ]]; then
  echo "Missing apps/askbible-mobile/scripts/android-sdk-env.sh" >&2
  exit 1
fi
# shellcheck source=/dev/null
source "apps/askbible-mobile/scripts/android-sdk-env.sh"

MOBILE="$ROOT/apps/askbible-mobile"
ENV_LOCAL="$MOBILE/.env.local"
ENV_LOCAL_BAK="$MOBILE/.env.local.release-build.bak"
if [[ -f "$ENV_LOCAL" ]]; then
  echo "→ Stashing .env.local (keep LAN dev URL out of release APK)"
  mv "$ENV_LOCAL" "$ENV_LOCAL_BAK"
  trap '[[ -f "$MOBILE/.env.local.release-build.bak" ]] && mv -f "$MOBILE/.env.local.release-build.bak" "$MOBILE/.env.local"' EXIT
fi

cd "$MOBILE/android"

echo "→ Gradle assembleRelease (bundled-only=$EXPO_PUBLIC_MOBILE_BUNDLED_ONLY, base=$EXPO_PUBLIC_ASKBIBLE_BASE_URL)"
./gradlew assembleRelease

APK="$MOBILE/android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$APK" ]]; then
  echo "APK not found at expected path: $APK" >&2
  exit 1
fi

OUT="$ROOT/dist/mobile"
mkdir -p "$OUT"
LATEST="$OUT/askbible-android-latest.apk"
cp "$APK" "$LATEST"
# 只保留一版库存（见 docs/mobile-build-artifacts.md）
bash "$ROOT/scripts/prune-mobile-dist.sh"

echo ""
echo "Built: $LATEST"
echo "Install: adb install -r \"$LATEST\""
echo "Or copy the file to the phone and open it (allow unknown sources)."
